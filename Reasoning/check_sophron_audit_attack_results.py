#!/usr/bin/env python3
from __future__ import annotations

import csv
from pathlib import Path

MATRIX = Path("Reasoning/sophron_audit_attack_matrix.csv")
RESULTS = Path("Reasoning/sophron_audit_attack_results.csv")
OUT = Path("Reasoning/sophron_audit_attack_results_check.csv")


def _norm(v: str) -> str:
    return (v or "").strip().lower()


def main() -> None:
    if not MATRIX.exists() or not RESULTS.exists():
        raise FileNotFoundError("missing matrix or results")

    with MATRIX.open("r", encoding="utf-8", newline="") as f:
        mrows = list(csv.DictReader(f))
    with RESULTS.open("r", encoding="utf-8", newline="") as f:
        rrows = list(csv.DictReader(f))

    expected = { (r.get("attack_id") or "").strip(): _norm(r.get("expected_result") or "") for r in mrows }
    results = { (r.get("attack_id") or "").strip(): r for r in rrows if (r.get("attack_id") or "").strip() }

    out_rows = []
    overall = True

    for aid in sorted(expected.keys()):
        rr = results.get(aid)
        if rr is None:
            out_rows.append({"attack_id": aid, "present": False, "complete": False, "coherent": False, "pass": False})
            overall = False
            continue

        exp = expected[aid]
        obs = _norm(rr.get("observed_result") or "")
        ev1 = (rr.get("detector_evidence") or "").strip()
        ev2 = (rr.get("log_evidence") or "").strip()
        complete = bool(obs and ev1 and ev2 and _norm(rr.get("expected_result") or "") in {"reject", "accept"})
        coherent = complete and (obs == exp)
        row_pass = complete and coherent and (_norm(rr.get("pass") or "") in {"true", "1", "yes"})
        out_rows.append(
            {
                "attack_id": aid,
                "present": True,
                "complete": complete,
                "coherent": coherent,
                "pass": row_pass,
            }
        )
        overall = overall and row_pass

    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()) if out_rows else ["attack_id", "pass"])
        w.writeheader()
        if out_rows:
            w.writerows(out_rows)

    print(f"Wrote {OUT}")
    print(f"STATUS={'pass' if overall else 'fail'}")


if __name__ == "__main__":
    main()
