#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from jsonschema import Draft202012Validator


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--schema", required=True)
    ap.add_argument("--raw-dir", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    schema_path = Path(args.schema)
    raw_dir = Path(args.raw_dir)
    out = Path(args.out)

    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)

    raw_dir.mkdir(parents=True, exist_ok=True)
    files = list(raw_dir.glob("*.jsonl"))

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
                else:
                    rows.append((str(p), i, True, ""))

    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as f:
        f.write("file,line,pass,error\n")
        for r in rows:
            f.write(f"{r[0]},{r[1]},{r[2]},{r[3]}\n")

    print(f"Wrote {out}")
    print(f"STATUS={'pass' if overall else 'fail'}")


if __name__ == "__main__":
    main()
