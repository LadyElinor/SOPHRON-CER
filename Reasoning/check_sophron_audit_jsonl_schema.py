#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator

SCHEMA_PATH = Path("Reasoning/schemas/sophron_audit_attack_run.schema.json")
RAW_DIR = Path("Reasoning/raw/audit_attack_runs")
OUT = Path("Reasoning/sophron_audit_jsonl_schema_check.csv")


def main() -> None:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)

    rows = []
    jsonl_files = list(RAW_DIR.glob("*.jsonl"))
    if not jsonl_files:
        OUT.write_text("file,line,pass,error\n,0,False,no_jsonl_files_found\n", encoding="utf-8")
        print(f"Wrote {OUT}")
        print("STATUS=fail")
        return

    overall = True
    for p in jsonl_files:
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
                overall = False
                rows.append((str(p), i, False, errs[0].message.replace(",", ";")))
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
