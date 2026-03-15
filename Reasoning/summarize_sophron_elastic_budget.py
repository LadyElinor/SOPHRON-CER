#!/usr/bin/env python3
from __future__ import annotations

import csv
from pathlib import Path

MATRIX = Path("Reasoning/sophron_elastic_budget_test_matrix.csv")
RESULTS = Path("Reasoning/sophron_elastic_budget_results.csv")
SUMMARY = Path("Reasoning/sophron_elastic_budget_summary.md")


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
        raise FileNotFoundError("missing elastic budget matrix/results")

    with MATRIX.open("r", encoding="utf-8", newline="") as f:
        mrows = list(csv.DictReader(f))
    with RESULTS.open("r", encoding="utf-8", newline="") as f:
        rrows = list(csv.DictReader(f))

    rmap = {(r.get("test_id") or "").strip(): r for r in rrows if (r.get("test_id") or "").strip()}

    lines = [
        "# SOPHRON-1 Elastic Budget Summary",
        "",
        "## Objective",
        "Evaluate bounded-elastic policy compliance while preserving deterministic execution guardrails.",
        "",
        "## Inputs",
        "- `Reasoning/sophron_elastic_budget_test_matrix.csv`",
        "- `Reasoning/sophron_elastic_budget_results.csv`",
        "",
        "## Scenario Outcomes",
        "| Test | Scenario | Expected | Observed | Policy Pass | Why |",
        "|---|---|---|---|---|---|",
    ]

    total = 0
    coherent = 0

    for m in mrows:
        tid = m["test_id"].strip()
        scenario = m.get("scenario", "")
        expected = _norm(m.get("expected_result", ""))
        rr = rmap.get(tid)
        if rr is None:
            lines.append(f"| {tid} | {scenario} | {expected} | missing | False | no result row |")
            continue

        observed = _norm(rr.get("observed_result", ""))
        ppass = _b(rr.get("pass", "False"))

        # explain which guardrails breached
        baseline = _f(m.get("baseline_budget_pct"), 10)
        burst = _f(m.get("burst_cap_pct"), 5)
        exec_floor = _f(m.get("execution_floor_pct"), 85)
        max_grants = _f(m.get("max_burst_grants_per_100"), 12)
        max_cum = _f(m.get("max_cumulative_burst_pct_per_100"), 40)
        max_jitter = _f(m.get("target_p95_jitter_increase_pct"), 8)

        obs_safety = _f(rr.get("observed_max_safety_budget_pct"))
        obs_exec = _f(rr.get("observed_min_execution_budget_pct"))
        obs_grants = _f(rr.get("observed_burst_grants_per_100"))
        obs_cum = _f(rr.get("observed_cumulative_burst_pct_per_100"))
        obs_jitter = _f(rr.get("observed_p95_jitter_increase_pct"))
        obs_escal = _b(rr.get("observed_safe_state_escalation", "False"))

        reasons = []
        if obs_safety > baseline + burst:
            reasons.append("safety-cap")
        if obs_exec < exec_floor:
            reasons.append("execution-floor")
        if obs_grants > max_grants:
            reasons.append("grant-frequency")
        if obs_cum > max_cum:
            reasons.append("cumulative-burst")
        if obs_jitter > max_jitter:
            reasons.append("jitter-cap")
        if tid == "EB-005" and not obs_escal:
            reasons.append("missing-escalation")
        why = "ok" if not reasons else ", ".join(reasons)

        total += 1
        if (expected == "pass" and observed == "pass") or (expected == "reject" and observed == "reject"):
            coherent += 1

        lines.append(f"| {tid} | {scenario} | {expected} | {observed} | {ppass} | {why} |")

    lines.extend([
        "",
        "## Summary Stats",
        f"- scenario rows with results: {total}",
        f"- expected/observed coherent rows: {coherent}/{total if total else 1}",
        f"- policy-pass rows: {sum(1 for r in rrows if _b(r.get('pass','False')))}",
        f"- policy-fail rows: {sum(1 for r in rrows if not _b(r.get('pass','False')))}",
        "",
        "## Note",
        "This summary reflects current harness outputs. For final sign-off, replace synthetic logs with hardware/sim-backed evidence.",
        "",
    ])

    SUMMARY.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {SUMMARY}")


if __name__ == "__main__":
    main()
