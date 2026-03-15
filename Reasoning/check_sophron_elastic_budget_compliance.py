#!/usr/bin/env python3
from __future__ import annotations

import csv
from pathlib import Path

MATRIX = Path("Reasoning/sophron_elastic_budget_test_matrix.csv")
RESULTS = Path("Reasoning/sophron_elastic_budget_results.csv")
OUT = Path("Reasoning/sophron_elastic_budget_compliance_check.csv")


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
        raise FileNotFoundError("missing matrix/results for elastic budget compliance")

    with MATRIX.open("r", encoding="utf-8", newline="") as f:
        mrows = list(csv.DictReader(f))
    with RESULTS.open("r", encoding="utf-8", newline="") as f:
        rrows = list(csv.DictReader(f))

    m = {r["test_id"].strip(): r for r in mrows}
    r = {x["test_id"].strip(): x for x in rrows if (x.get("test_id") or "").strip()}

    out_rows = []
    overall = True

    for tid in sorted(m.keys()):
        mr = m[tid]
        rr = r.get(tid)
        if rr is None:
            out_rows.append({"test_id": tid, "present": False, "complete": False, "coherent": False, "pass": False})
            overall = False
            continue

        needed = [
            "observed_max_safety_budget_pct",
            "observed_min_execution_budget_pct",
            "observed_burst_grants_per_100",
            "observed_cumulative_burst_pct_per_100",
            "observed_p95_jitter_increase_pct",
            "observed_safe_state_escalation",
            "observed_result",
            "log_evidence",
            "pass",
        ]
        complete = all((rr.get(k) or "").strip() for k in needed)

        coherent = False
        if complete:
            baseline = _f(mr.get("baseline_budget_pct"))
            burst = _f(mr.get("burst_cap_pct"))
            exec_floor = _f(mr.get("execution_floor_pct"))
            max_grants = _f(mr.get("max_burst_grants_per_100"))
            max_cum = _f(mr.get("max_cumulative_burst_pct_per_100"))
            max_jitter = _f(mr.get("target_p95_jitter_increase_pct"))
            expected = _norm(mr.get("expected_result"))

            obs_safety = _f(rr.get("observed_max_safety_budget_pct"))
            obs_exec = _f(rr.get("observed_min_execution_budget_pct"))
            obs_grants = _f(rr.get("observed_burst_grants_per_100"))
            obs_cum = _f(rr.get("observed_cumulative_burst_pct_per_100"))
            obs_jitter = _f(rr.get("observed_p95_jitter_increase_pct"))
            obs_escal = _b(rr.get("observed_safe_state_escalation"))
            observed = _norm(rr.get("observed_result"))
            reported_pass = _b(rr.get("pass"))

            policy_ok = (
                obs_safety <= baseline + burst
                and obs_exec >= exec_floor
                and obs_grants <= max_grants
                and obs_cum <= max_cum
                and obs_jitter <= max_jitter
            )

            if expected == "pass":
                expected_observed = "pass"
            else:
                expected_observed = "reject"

            # For explicit escalation scenario, ensure escalation happened
            if tid == "EB-005":
                policy_ok = policy_ok and obs_escal

            coherent = (observed == expected_observed) and (reported_pass == policy_ok)

        row_pass = complete and coherent
        overall = overall and row_pass
        out_rows.append({
            "test_id": tid,
            "present": True,
            "complete": complete,
            "coherent": coherent,
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
