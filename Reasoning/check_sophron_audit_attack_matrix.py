#!/usr/bin/env python3
from __future__ import annotations

import csv
from pathlib import Path

INPUT = Path("Reasoning/sophron_audit_attack_matrix.csv")
OUT = Path("Reasoning/sophron_audit_attack_matrix_check.csv")
REQUIRED_ATTACKS = {"AUD-001", "AUD-002", "AUD-003", "AUD-004", "AUD-005", "AUD-006"}


def main() -> None:
    if not INPUT.exists():
        raise FileNotFoundError(INPUT)

    with INPUT.open("r", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    seen = { (r.get("attack_id") or "").strip() for r in rows }
    missing = sorted(REQUIRED_ATTACKS - seen)

    out_rows = []
    overall = True

    for r in rows:
        aid = (r.get("attack_id") or "").strip()
        has_det = bool((r.get("expected_detector") or "").strip())
        exp = (r.get("expected_result") or "").strip().lower()
        owner_ok = bool((r.get("owner") or "").strip() and (r.get("owner") or "").strip().lower() != "unassigned")
        row_pass = has_det and exp in {"reject", "accept"} and owner_ok
        overall = overall and row_pass
        out_rows.append({
            "attack_id": aid,
            "has_expected_detector": has_det,
            "expected_result_valid": exp in {"reject", "accept"},
            "owner_ok": owner_ok,
            "pass": row_pass,
        })

    if missing:
        overall = False
        out_rows.append({
            "attack_id": "MISSING_REQUIRED",
            "has_expected_detector": False,
            "expected_result_valid": False,
            "owner_ok": False,
            "pass": False,
        })

    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()) if out_rows else ["attack_id", "pass"])
        w.writeheader()
        if out_rows:
            w.writerows(out_rows)

    if missing:
        print(f"MISSING={','.join(missing)}")
    print(f"Wrote {OUT}")
    print(f"STATUS={'pass' if overall else 'fail'}")


if __name__ == "__main__":
    main()
