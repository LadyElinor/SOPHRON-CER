#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator

SCHEMA_PATH = Path("Reasoning/schemas/sophron_safety_frame_v0_3.schema.json")
RAW_DIR = Path("Reasoning/raw/safety_frames")
OUT = Path("Reasoning/sophron_safety_frame_schema_check.csv")


def main() -> None:
    if not SCHEMA_PATH.exists():
        raise FileNotFoundError(SCHEMA_PATH)

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    files = list(RAW_DIR.glob("*.jsonl"))

    rows = []
    overall = True

    if not files:
        rows.append(("", 0, False, "no_jsonl_files_found"))
        overall = False
    else:
        for p in files:
            for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), start=1):
                if not line.strip():
                    continue
                try:
                    rec = json.loads(line)
                except Exception as e:
                    rows.append((str(p), i, False, f"json_parse_error:{e}"))
                    overall = False
                    continue

                errs = sorted(validator.iter_errors(rec), key=lambda e: list(e.path))
                if errs:
                    rows.append((str(p), i, False, errs[0].message.replace(",", ";")))
                    overall = False
                    continue

                # runtime semantic checks beyond schema
                b = float(rec.get("baseline_budget_pct", 0))
                br = float(rec.get("burst_budget_pct", 0))
                s = float(rec.get("safety_budget_total_pct", 0))
                e = float(rec.get("execution_budget_pct", 0))
                floor = float(rec.get("execution_floor_pct", 85))

                err = ""
                if abs((s + e) - 100.0) > 0.5:
                    err = "budget_sum_not_close_to_100"
                elif abs((b + br) - s) > 0.5:
                    err = "safety_total_not_close_to_baseline_plus_burst"
                elif e < floor:
                    err = "execution_floor_violation"

                if err:
                    rows.append((str(p), i, False, err))
                    overall = False
                else:
                    rows.append((str(p), i, True, ""))

    with OUT.open("w", encoding="utf-8") as f:
        f.write("file,line,pass,error\n")
        for r in rows:
            f.write(f"{r[0]},{r[1]},{r[2]},{r[3]}\n")

    print(f"Wrote {OUT}")
    print(f"STATUS={'pass' if overall else 'fail'}")


if __name__ == "__main__":
    main()
