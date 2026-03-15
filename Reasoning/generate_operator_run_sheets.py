#!/usr/bin/env python3
from __future__ import annotations

import csv
from pathlib import Path

PROBE = Path("Reasoning/sophron_probe_budget_test_matrix.csv")
SKEW = Path("Reasoning/sophron_skew_injection_campaign.csv")
OUT_DIR = Path("Reasoning/run_sheets")


def _slug(s: str) -> str:
    return "".join(c.lower() if c.isalnum() else "-" for c in s).strip("-")


def write_probe_sheet() -> None:
    if not PROBE.exists():
        return
    rows = list(csv.DictReader(PROBE.open("r", encoding="utf-8", newline="")))
    out = OUT_DIR / "operator_run_sheet_probe_budget.md"
    lines = [
        "# SOPHRON Operator Run Sheet — Probe Budget",
        "",
        "## Preflight (must pass)",
        "1. Confirm safety frame schema check is green:",
        "   - `python Reasoning/check_sophron_safety_frame_jsonl_schema.py`",
        "2. Confirm raw output directory exists:",
        "   - `Reasoning/raw/probe_budget_runs/`",
        "3. Time sync host clock and ensure UTC timestamps in logs.",
        "",
        "## Run matrix",
        "| test_id | campaign_id | budget | workload | fault | reps | targets | run command template |",
        "|---|---|---:|---|---|---:|---|---|",
    ]
    for r in rows:
        tid = r["test_id"]
        cid = f"PB-CAM-{tid}"
        targets = f"p95<={r['target_p95_detection_latency_ms']} fnr<={r['target_false_negative_rate']} fpr<={r['target_false_positive_rate']} tpen<={r['target_throughput_penalty_percent']}"
        cmd = (
            f"python your_runner.py --campaign-id {cid} --test-id {tid} "
            f"--budget {r['budget_percent']} --workload {r['workload_profile']} --fault {r['fault_type']} "
            f"--reps {r['replicates']} --out Reasoning/raw/probe_budget_runs/{_slug(cid)}.jsonl"
        )
        lines.append(f"| {tid} | {cid} | {r['budget_percent']} | {r['workload_profile']} | {r['fault_type']} | {r['replicates']} | {targets} | `{cmd}` |")

    lines.extend([
        "",
        "## Post-run",
        "1. Ingest: `python Reasoning/ingest_probe_budget_real_logs.py`",
        "2. Check: `python Reasoning/check_sophron_probe_budget_results.py`",
        "3. Summarize: `python Reasoning/summarize_sophron_probe_budget.py`",
    ])
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_skew_sheet() -> None:
    if not SKEW.exists():
        return
    rows = list(csv.DictReader(SKEW.open("r", encoding="utf-8", newline="")))
    out = OUT_DIR / "operator_run_sheet_skew_injection.md"
    lines = [
        "# SOPHRON Operator Run Sheet — Cross-Plane Skew Injection",
        "",
        "## Preflight (must pass)",
        "1. Confirm safety frame schema check is green:",
        "   - `python Reasoning/check_sophron_safety_frame_jsonl_schema.py`",
        "2. Confirm raw output directory exists:",
        "   - `Reasoning/raw/skew_runs/`",
        "3. Ensure watchdog + stale-heartbeat telemetry enabled.",
        "",
        "## Run matrix",
        "| campaign_id | phase | workload | pretrigger | skew_ms | jitter_ms | loss% | reps | expectation | command template |",
        "|---|---|---|---|---:|---:|---:|---:|---|---|",
    ]
    for r in rows:
        cid = r["campaign_id"]
        cmd = (
            f"python your_skew_runner.py --campaign-id {cid} --phase {r['phase']} "
            f"--workload {r['workload_profile']} --pretrigger {r['pretrigger_profile']} "
            f"--skew-ms {r['skew_ms']} --jitter-ms {r['jitter_ms']} --loss-pct {r['packet_loss_pct']} "
            f"--reps {r['replicates']} --out Reasoning/raw/skew_runs/{_slug(cid)}.jsonl"
        )
        expectation = "boundary-search" if r.get("phase") == "B" else "coarse-scan"
        lines.append(
            f"| {cid} | {r['phase']} | {r['workload_profile']} | {r['pretrigger_profile']} | {r['skew_ms']} | {r['jitter_ms']} | {r['packet_loss_pct']} | {r['replicates']} | {expectation} | `{cmd}` |"
        )

    lines.extend([
        "",
        "## Safe envelope reminders",
        "- Keep execution floor >= 85%",
        "- Watch for jitter-cap violations and escalation-level transitions",
        "- Flag runs where observed behavior mismatches expected_result immediately",
        "",
        "## Post-run",
        "1. Ingest: `python Reasoning/ingest_sophron_skew_real_logs.py`",
        "2. Check: `python Reasoning/check_sophron_cross_plane_skew.py`",
        "3. Summarize: `python Reasoning/summarize_sophron_cross_plane_skew.py`",
    ])
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_master_sheet() -> None:
    out = OUT_DIR / "operator_run_sheet_master.md"
    out.write_text(
        "# SOPHRON Operator Master Run Sheet\n\n"
        "1. Run probe campaign using `operator_run_sheet_probe_budget.md`\n"
        "2. Run skew campaign using `operator_run_sheet_skew_injection.md`\n"
        "3. Ingest + validate all evidence:\n"
        "   - `python Reasoning/run_sophron_real_evidence_pipeline.py`\n"
        "4. Review status card:\n"
        "   - `Reasoning/sophron_unc_status_card.md`\n",
        encoding="utf-8",
    )


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write_probe_sheet()
    write_skew_sheet()
    write_master_sheet()
    print(f"Wrote run sheets in {OUT_DIR}")


if __name__ == "__main__":
    main()
