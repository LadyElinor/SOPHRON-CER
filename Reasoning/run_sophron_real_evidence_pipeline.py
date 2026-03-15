#!/usr/bin/env python3
from __future__ import annotations

import csv
import subprocess
import sys
from pathlib import Path

ROOT = Path("Reasoning")
STATUS_CARD = ROOT / "sophron_unc_status_card.md"


def run(cmd: list[str]) -> int:
    p = subprocess.run(cmd, capture_output=True, text=True)
    sys.stdout.write(p.stdout)
    sys.stderr.write(p.stderr)
    return p.returncode


def read_check_status(path: Path) -> str:
    if not path.exists():
        return "missing"
    with path.open("r", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        return "missing"

    # Prefer explicit status lane when available (e.g., REGRESSION_WARNING).
    status_vals = {str(r.get("status", "")).strip().upper() for r in rows if str(r.get("status", "")).strip()}
    if "FAIL" in status_vals:
        return "fail"
    if "REGRESSION_WARNING" in status_vals:
        return "warning"
    if "PASS" in status_vals and len(status_vals) == 1:
        return "pass"

    if all(str(r.get("pass", "")).lower() in {"true", "1"} for r in rows):
        return "pass"
    if any(str(r.get("pass", "")).lower() in {"true", "1"} for r in rows):
        return "partial"
    return "fail"


def read_regression_status(path: Path) -> str:
    if not path.exists():
        return "MISSING"
    rows = list(csv.DictReader(path.open("r", encoding="utf-8", newline="")))
    if not rows:
        return "MISSING"
    return str(rows[0].get("status", "MISSING")).strip().upper() or "MISSING"


def read_bridge_elastic_status(path: Path) -> str:
    if not path.exists():
        return "MISSING"
    rows = list(csv.DictReader(path.open("r", encoding="utf-8", newline="")))
    if not rows:
        return "MISSING"
    return str(rows[0].get("elastic_status", "")).strip().upper() or "MISSING"


def read_target10_pass(path: Path) -> str:
    if not path.exists():
        return "MISSING"
    rows = list(csv.DictReader(path.open("r", encoding="utf-8", newline="")))
    if not rows:
        return "MISSING"
    return "PASS" if str(rows[0].get("pass", "")).strip().lower() in {"true", "1", "yes"} else "FAIL"


def read_chunked10_mean_p95(path: Path) -> str:
    if not path.exists():
        return ""
    rows = list(csv.DictReader(path.open("r", encoding="utf-8", newline="")))
    for r in rows:
        if (r.get("audit_mode") == "chunked") and str(r.get("budget_percent")) == "10":
            return str(r.get("mean_p95_ms", ""))
    return ""


def read_core_elastic_pass(path: Path, budget_cap: int) -> str:
    if not path.exists():
        return "MISSING"
    rows = list(csv.DictReader(path.open("r", encoding="utf-8", newline="")))
    targets = [
        r for r in rows
        if (r.get("test_id") or "").startswith("PB-C-")
        and (r.get("audit_mode") or "") == "chunked"
        and str(r.get("budget_percent")) == "10"
    ]
    if len(targets) < 5:
        return "MISSING"

    for r in targets:
        try:
            p95 = float(r.get("p95_detection_latency_ms") or 1e9)
            fnr = float(r.get("false_negative_rate") or 1.0)
            fpr = float(r.get("false_positive_rate") or 1.0)
            tpen = float(r.get("throughput_penalty_percent") or 1e9)
            sctr = float(r.get("safe_state_transition_correct_rate") or 0.0)
        except Exception:
            return "FAIL"
        if not (p95 <= 200 and fnr <= 0.0 and fpr <= 0.005 and tpen <= float(budget_cap) and sctr >= 0.99):
            return "FAIL"
    return "PASS"


def main() -> None:
    steps = [
        ["python", "Reasoning/simulate_probe_mode_raw_runs.py"],
        ["python", "Reasoning/check_sophron_probe_jsonl_schema.py"],
        ["python", "Reasoning/check_sophron_skew_jsonl_schema.py"],
        ["python", "Reasoning/check_sophron_audit_jsonl_schema.py"],
        ["python", "Reasoning/check_sophron_safety_frame_jsonl_schema.py"],
        ["python", "Reasoning/ingest_probe_budget_real_logs.py"],
        ["python", "Reasoning/ingest_sophron_skew_real_logs.py"],
        ["python", "Reasoning/ingest_sophron_audit_real_logs.py"],
        ["python", "Reasoning/check_sophron_probe_budget_results.py"],
        ["python", "Reasoning/check_sophron_probe_target10.py"],
        ["python", "Reasoning/check_sophron_probe_budget_bridge.py"],
        ["python", "Reasoning/check_sophron_adversarial_policy_resilience.py"],
        ["python", "Reasoning/check_sophron_cross_plane_skew.py"],
        ["python", "Reasoning/check_sophron_audit_attack_results.py"],
        ["python", "Reasoning/summarize_sophron_probe_budget.py"],
        ["python", "Reasoning/summarize_probe_mode_comparison.py"],
        ["python", "Reasoning/sophron_regression_delta_checker.py"],
        ["python", "Reasoning/summarize_sophron_cross_plane_skew.py"],
    ]

    rc_any = 0
    for s in steps:
        print(f"[pipeline] {' '.join(s)}")
        rc = run(s)
        if rc != 0:
            rc_any = rc_any or rc

    unc001 = read_check_status(ROOT / "sophron_probe_budget_results_check.csv")
    unc001_bridge = read_check_status(ROOT / "sophron_probe_budget_bridge_check.csv")
    unc001_target10 = read_check_status(ROOT / "sophron_probe_target10_check.csv")
    regression = read_check_status(ROOT / "sophron_regression_delta_check.csv")
    elastic_bridge = read_bridge_elastic_status(ROOT / "sophron_probe_budget_bridge_check.csv")
    adv_policy = read_check_status(ROOT / "sophron_adversarial_resilience_check.csv")
    unc002 = read_check_status(ROOT / "sophron_cross_plane_skew_check.csv")
    unc003 = read_check_status(ROOT / "sophron_audit_attack_results_check.csv")
    raw_probe = read_check_status(ROOT / "sophron_probe_jsonl_schema_check.csv")
    raw_skew = read_check_status(ROOT / "sophron_skew_jsonl_schema_check.csv")
    raw_audit = read_check_status(ROOT / "sophron_audit_jsonl_schema_check.csv")
    core_frame = read_check_status(ROOT / "sophron_safety_frame_schema_check.csv")

    if elastic_bridge == "PASS":
        elastic_state = "NOMINAL"
    elif elastic_bridge == "PASS_ELASTIC" or regression == "warning":
        elastic_state = "STABILIZING"
    elif elastic_bridge == "FAIL":
        elastic_state = "FAIL-SAFE"
    else:
        elastic_state = "MISSING"

    lines = [
        "# SOPHRON UNC Status Card",
        "",
        "| Uncertainty | Scope | Status | Evidence |",
        "|---|---|---|---|",
        f"| SOPH-RAW-PROBE | Probe JSONL schema compliance | {raw_probe.upper()} | `Reasoning/sophron_probe_jsonl_schema_check.csv` |",
        f"| SOPH-RAW-SKEW | Skew JSONL schema compliance | {raw_skew.upper()} | `Reasoning/sophron_skew_jsonl_schema_check.csv` |",
        f"| SOPH-RAW-AUDIT | Audit JSONL schema compliance | {raw_audit.upper()} | `Reasoning/sophron_audit_jsonl_schema_check.csv` |",
        f"| SOPH-UNC-001 | Probe budget selection | {unc001.upper()} | `Reasoning/sophron_probe_budget_summary.md` |",
        f"| SOPH-UNC-001-BRIDGE | Probe budget 20/25 bridge sufficiency | {unc001_bridge.upper()} | `Reasoning/sophron_probe_budget_bridge_check.csv` |",
        f"| SOPH-UNC-001-TARGET10 | Chunked 10% target sufficiency | {unc001_target10.upper()} | `Reasoning/sophron_probe_target10_check.csv` |",
        f"| SOPH-REG-DELTA | Baseline regression delta guard | {regression.upper()} | `Reasoning/sophron_regression_delta_check.csv` |",
        f"| SOPH-ELASTIC-STATE | Dynamic safety posture (NOMINAL/STABILIZING/FAIL-SAFE) | {elastic_state} | `Reasoning/sophron_probe_budget_bridge_check.csv` |",
        f"| SOPH-ADV-POLICY | Adversarial policy resilience (deny/contain checks) | {adv_policy.upper()} | `Reasoning/sophron_adversarial_resilience_check.csv` |",
        f"| SOPH-UNC-002 | Cross-plane skew tolerance | {unc002.upper()} | `Reasoning/sophron_cross_plane_skew_summary.md` |",
        f"| SOPH-UNC-003 | Audit replay/truncation robustness | {unc003.upper()} | `Reasoning/sophron_audit_attack_results.csv` |",
        f"| SOPH-CORE-FRAME | Safety frame schema/runtime semantics | {core_frame.upper()} | `Reasoning/sophron_safety_frame_schema_check.csv` |",
        "| SOPH-SAFETY-CASE | Formal safety-case summary/specification | INFO | `Reasoning/SOPHRON-1-safety-case-v1.md` |",
        "",
        "## Overall",
    ]

    statuses = [raw_probe, raw_skew, raw_audit, unc001, unc001_bridge, unc001_target10, regression, adv_policy, unc002, unc003, core_frame]
    if all(s == "pass" for s in statuses):
        overall = "PASS"
    elif any(s == "fail" for s in statuses):
        overall = "FAIL"
    else:
        overall = "PARTIAL"

    lines.append(f"- overall: **{overall}**")
    lines.append("")
    lines.append("## Challenge Matrix View")
    lines.append("")
    lines.append("| Scenario | Core Elastic Pass | Robust TARGET10 | REG-DELTA | chunked@10 mean p95 (ms) |")
    lines.append("|---|---|---|---|---:|")

    challenge_root = ROOT / "challenges"
    matrix_labels = [
        "BASELINE",
        "CHAL-01",
        "CHAL-02-noise-1.25",
        "CHAL-02-noise-1.25-RAW",
        "CHAL-02-noise-1.25-EMA035",
        "CHAL-02-noise-1.25-EMA015",
        "CHAL-02-noise-1.50",
        "CHAL-02-noise-2.00",
        "CHAL-02-noise-2.50",
        "CHAL-02-burst-15",
        "CHAL-02-burst-18",
        "CHAL-02-burst-20",
    ]
    for label in matrix_labels:
        d = challenge_root / label
        t10 = read_target10_pass(d / "sophron_probe_target10_check.csv")
        reg = read_regression_status(d / "sophron_regression_delta_check.csv")
        p95 = read_chunked10_mean_p95(d / "sophron_probe_mode_comparison.csv")

        budget_cap = 10
        if label.startswith("CHAL-02-burst-"):
            try:
                budget_cap = int(label.split("-")[-1])
            except Exception:
                budget_cap = 10
        core_elastic = read_core_elastic_pass(d / "sophron_probe_budget_results.csv", budget_cap)

        lines.append(f"| {label} | {core_elastic} | {t10} | {reg} | {p95} |")

    lines.append("")
    lines.append("## Notes")
    lines.append("- Status is computed from check CSV artifacts.")
    lines.append("- For final sign-off, ensure raw inputs are hardware/sim-backed logs, not synthetic harness outputs.")
    lines.append("")

    STATUS_CARD.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {STATUS_CARD}")

    raise SystemExit(rc_any)


if __name__ == "__main__":
    main()
