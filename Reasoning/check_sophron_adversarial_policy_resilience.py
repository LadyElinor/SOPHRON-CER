#!/usr/bin/env python3
from __future__ import annotations

import csv
from pathlib import Path

MATRIX = Path("Reasoning/sophron_adversarial_challenge_matrix.csv")
OUT = Path("Reasoning/sophron_adversarial_resilience_check.csv")


def main() -> None:
    if not MATRIX.exists():
        raise FileNotFoundError(MATRIX)

    rows = list(csv.DictReader(MATRIX.open("r", encoding="utf-8", newline="")))

    # Policy-resilience baseline checker (design-time):
    # validates that every adversarial family has explicit deny/contain expectations.
    out_rows = []
    overall = True
    for r in rows:
        tid = (r.get("test_id") or "").strip()
        expected = (r.get("expected_behavior") or "").strip().lower()
        has_explicit_guard = expected in {"deny_and_log", "contain_and_flag"}

        row_pass = bool(tid) and has_explicit_guard
        overall = overall and row_pass

        out_rows.append({
            "test_id": tid,
            "expected_behavior": expected,
            "has_explicit_guard": has_explicit_guard,
            "pass": row_pass,
        })

    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()) if out_rows else ["test_id", "pass"])
        w.writeheader()
        if out_rows:
            w.writerows(out_rows)

    print(f"Wrote {OUT}")
    print(f"STATUS={'pass' if overall else 'fail'}")


if __name__ == "__main__":
    main()
