#!/usr/bin/env python3
from __future__ import annotations

import csv
from pathlib import Path

MATRIX = Path("Reasoning/sophron_probe_budget_test_matrix.csv")
RESULTS = Path("Reasoning/sophron_probe_budget_results.csv")
OUT = Path("Reasoning/sophron_probe_budget_results_check.csv")


def _f(v: str):
    s = (v or "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def main() -> None:
    if not MATRIX.exists() or not RESULTS.exists():
        raise FileNotFoundError("missing matrix or results file")

    with MATRIX.open("r", encoding="utf-8", newline="") as f:
        mrows = list(csv.DictReader(f))
    with RESULTS.open("r", encoding="utf-8", newline="") as f:
        rrows = list(csv.DictReader(f))

    m_ids = {r["test_id"].strip() for r in mrows}
    r_map = {r["test_id"].strip(): r for r in rrows if (r.get("test_id") or "").strip()}

    out_rows = []
    overall = True

    for mid in sorted(m_ids):
        rr = r_map.get(mid)
        if rr is None:
            out_rows.append({"test_id": mid, "present": False, "complete": False, "pass": False})
            overall = False
            continue

        required = [
            "runs",
            "p95_detection_latency_ms",
            "false_negative_rate",
            "false_positive_rate",
            "throughput_penalty_percent",
            "safe_state_transition_correct_rate",
            "pass",
        ]
        complete = all((rr.get(k) or "").strip() for k in required)
        present = True

        # If complete, also check reported pass is coherent with thresholds from matrix row.
        coherent = True
        if complete:
            mr = next(x for x in mrows if x["test_id"].strip() == mid)
            p95 = _f(rr.get("p95_detection_latency_ms"))
            fnr = _f(rr.get("false_negative_rate"))
            fpr = _f(rr.get("false_positive_rate"))
            tpen = _f(rr.get("throughput_penalty_percent"))
            sctr = _f(rr.get("safe_state_transition_correct_rate"))
            target_p95 = _f(mr.get("target_p95_detection_latency_ms"))
            target_fnr = _f(mr.get("target_false_negative_rate"))
            target_fpr = _f(mr.get("target_false_positive_rate"))
            target_tpen = _f(mr.get("target_throughput_penalty_percent"))
            reported_pass = str(rr.get("pass", "")).strip().lower() in {"true", "1", "yes"}

            calc_pass = (
                p95 is not None and target_p95 is not None and p95 <= target_p95
                and fnr is not None and target_fnr is not None and fnr <= target_fnr
                and fpr is not None and target_fpr is not None and fpr <= target_fpr
                and tpen is not None and target_tpen is not None and tpen <= target_tpen
                and sctr is not None and sctr >= 0.99
            )
            coherent = (reported_pass == calc_pass)

        row_pass = present and complete and coherent
        overall = overall and row_pass
        out_rows.append({"test_id": mid, "present": present, "complete": complete, "coherent": coherent, "pass": row_pass})

    with OUT.open("w", encoding="utf-8", newline="") as f:
        fieldnames = list(out_rows[0].keys()) if out_rows else ["test_id", "pass"]
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        if out_rows:
            w.writerows(out_rows)

    print(f"Wrote {OUT}")
    print(f"STATUS={'pass' if overall else 'fail'}")


if __name__ == "__main__":
    main()
