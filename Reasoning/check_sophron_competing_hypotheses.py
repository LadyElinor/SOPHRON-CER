#!/usr/bin/env python3
from __future__ import annotations

import csv
from pathlib import Path

INPUT = Path("Reasoning/competing_hypotheses_matrix_sophron1.csv")
OUT = Path("Reasoning/competing_hypotheses_check_sophron1.csv")


def main() -> None:
    if not INPUT.exists():
        raise FileNotFoundError(INPUT)

    with INPUT.open("r", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    by_risk = {}
    for r in rows:
        by_risk.setdefault((r.get("risk_id") or "").strip(), []).append(r)

    out_rows = []
    overall = True
    for risk_id, rs in sorted(by_risk.items()):
        hyp_ids = { (r.get("hypothesis_id") or "").strip() for r in rs if (r.get("hypothesis_id") or "").strip() }
        has_pred = all((r.get("predicted_signature") or "").strip() for r in rs)
        has_test = all((r.get("disconfirming_test") or "").strip() for r in rs)
        conf_ok = all((r.get("current_confidence") or "").strip() for r in rs)
        row_pass = len(hyp_ids) >= 2 and has_pred and has_test and conf_ok
        overall = overall and row_pass
        out_rows.append({
            "risk_id": risk_id,
            "hypothesis_count": len(hyp_ids),
            "has_predicted_signature": has_pred,
            "has_disconfirming_test": has_test,
            "has_confidence": conf_ok,
            "pass": row_pass,
        })

    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()) if out_rows else ["risk_id", "pass"])
        w.writeheader()
        if out_rows:
            w.writerows(out_rows)

    print(f"Wrote {OUT}")
    print(f"STATUS={'pass' if overall else 'fail'}")


if __name__ == "__main__":
    main()
