#!/usr/bin/env python3
from __future__ import annotations

import csv
from pathlib import Path

MATRIX = Path("Reasoning/sophron_cross_plane_skew_test_matrix.csv")
RESULTS = Path("Reasoning/sophron_cross_plane_skew_results.csv")
OUT = Path("Reasoning/sophron_cross_plane_skew_check.csv")


def _f(v: str, d: float = 0.0) -> float:
    try:
        return float((v or "").strip())
    except Exception:
        return d


def _b(v: str) -> bool:
    return str(v).strip().lower() in {"true", "1", "yes"}


def _norm(v: str) -> str:
    return (v or "").strip().lower()


def main() -> None:
    if not MATRIX.exists() or not RESULTS.exists():
        raise FileNotFoundError("missing skew matrix/results")

    with MATRIX.open("r", encoding="utf-8", newline="") as f:
        mrows = list(csv.DictReader(f))
    with RESULTS.open("r", encoding="utf-8", newline="") as f:
        rrows = list(csv.DictReader(f))

    rmap = {(r.get("test_id") or "").strip(): r for r in rrows if (r.get("test_id") or "").strip()}

    out_rows = []
    overall = True
    for m in mrows:
        tid = m["test_id"].strip()
        rr = rmap.get(tid)
        if rr is None:
            out_rows.append({"test_id": tid, "present": False, "complete": False, "coherent": False, "pass": False})
            overall = False
            continue

        required = [
            "runs",
            "observed_false_negative_rate",
            "observed_false_positive_rate",
            "observed_p95_detection_latency_ms",
            "observed_safe_state_correct_rate",
            "log_evidence",
            "pass",
        ]
        complete = all((rr.get(k) or "").strip() for k in required)

        coherent = False
        if complete:
            fnr = _f(rr.get("observed_false_negative_rate"))
            fpr = _f(rr.get("observed_false_positive_rate"))
            p95 = _f(rr.get("observed_p95_detection_latency_ms"))
            sctr = _f(rr.get("observed_safe_state_correct_rate"))

            t_fnr = _f(m.get("target_false_negative_rate"))
            t_fpr = _f(m.get("target_false_positive_rate"))
            t_p95 = _f(m.get("target_p95_detection_latency_ms"))
            t_sctr = _f(m.get("target_safe_state_correct_rate"))

            calc_pass = fnr <= t_fnr and fpr <= t_fpr and p95 <= t_p95 and sctr >= t_sctr
            expected = _norm(m.get("expected_result"))
            observed = "pass" if calc_pass else "reject"
            coherent = observed == expected and _b(rr.get("pass")) == calc_pass

        row_pass = complete and coherent
        overall = overall and row_pass
        out_rows.append({"test_id": tid, "present": True, "complete": complete, "coherent": coherent, "pass": row_pass})

    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()) if out_rows else ["test_id", "pass"])
        w.writeheader()
        if out_rows:
            w.writerows(out_rows)

    print(f"Wrote {OUT}")
    print(f"STATUS={'pass' if overall else 'fail'}")


if __name__ == "__main__":
    main()
