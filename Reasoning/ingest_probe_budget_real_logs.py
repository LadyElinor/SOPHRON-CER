#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import math
import os
from pathlib import Path

MATRIX = Path("Reasoning/sophron_probe_budget_test_matrix.csv")
RAW_DIR = Path("Reasoning/raw/probe_budget_runs")
OUT = Path("Reasoning/sophron_probe_budget_results.csv")
FILTER_MODE = os.getenv("SOPHRON_FILTER_MODE", "none").strip().lower()
try:
    FILTER_ALPHA = float(os.getenv("SOPHRON_FILTER_ALPHA", "0.35"))
except Exception:
    FILTER_ALPHA = 0.35
FILTER_ALPHA = max(0.01, min(0.99, FILTER_ALPHA))


def _percentile(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    xs = sorted(values)
    if len(xs) == 1:
        return xs[0]
    p = (len(xs) - 1) * q
    lo = int(math.floor(p))
    hi = int(math.ceil(p))
    if lo == hi:
        return xs[lo]
    return xs[lo] + (xs[hi] - xs[lo]) * (p - lo)


def _stddev(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    mu = sum(values) / len(values)
    var = sum((x - mu) ** 2 for x in values) / (len(values) - 1)
    return math.sqrt(var)


def _cv(values: list[float]) -> float:
    if not values:
        return 0.0
    mu = sum(values) / len(values)
    if abs(mu) < 1e-12:
        return 0.0
    return _stddev(values) / abs(mu)


def _ema(values: list[float], alpha: float) -> list[float]:
    if not values:
        return []
    out = [values[0]]
    for x in values[1:]:
        out.append(alpha * x + (1.0 - alpha) * out[-1])
    return out


def _maybe_filter(values: list[float]) -> list[float]:
    if FILTER_MODE == "ema":
        return _ema(values, FILTER_ALPHA)
    return values


def main() -> None:
    if not MATRIX.exists():
        raise FileNotFoundError(MATRIX)
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    by_test: dict[str, list[dict]] = {}
    for p in RAW_DIR.glob("*.jsonl"):
        for line in p.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            rec = json.loads(line)
            tid = str(rec.get("test_id", "")).strip()
            if not tid:
                continue
            by_test.setdefault(tid, []).append(rec)

    with MATRIX.open("r", encoding="utf-8", newline="") as f:
        mrows = list(csv.DictReader(f))

    out_rows = []
    for m in mrows:
        tid = m["test_id"].strip()
        rs = by_test.get(tid, [])
        expected_reps = int(float(m.get("replicates") or 30))

        if not rs:
            out_rows.append({
                "test_id": tid,
                "budget_percent": m.get("budget_percent", ""),
                "audit_mode": m.get("audit_mode", "monolithic"),
                "filter_mode": FILTER_MODE,
                "filter_alpha": FILTER_ALPHA,
                "workload_profile": m.get("workload_profile", ""),
                "fault_type": m.get("fault_type", ""),
                "runs": "",
                "replicate_count": "",
                "expected_replicates": expected_reps,
                "replicate_coverage": False,
                "p95_detection_latency_ms": "",
                "false_negative_rate": "",
                "false_positive_rate": "",
                "throughput_penalty_percent": "",
                "safe_state_transition_correct_rate": "",
                "p95_detection_latency_ms_p90": "",
                "p95_detection_latency_ms_p95": "",
                "p95_detection_latency_ms_worst": "",
                "p95_detection_latency_ms_stddev": "",
                "p95_detection_latency_ms_cv": "",
                "false_negative_rate_p90": "",
                "false_negative_rate_p95": "",
                "false_negative_rate_worst": "",
                "false_negative_rate_stddev": "",
                "false_negative_rate_cv": "",
                "false_positive_rate_p90": "",
                "false_positive_rate_p95": "",
                "false_positive_rate_worst": "",
                "false_positive_rate_stddev": "",
                "false_positive_rate_cv": "",
                "throughput_penalty_percent_p90": "",
                "throughput_penalty_percent_p95": "",
                "throughput_penalty_percent_worst": "",
                "throughput_penalty_percent_stddev": "",
                "throughput_penalty_percent_cv": "",
                "safe_state_transition_correct_rate_p10": "",
                "safe_state_transition_correct_rate_p05": "",
                "safe_state_transition_correct_rate_worst": "",
                "safe_state_transition_correct_rate_stddev": "",
                "safe_state_transition_correct_rate_cv": "",
                "latency_margin_ms": "",
                "fnr_margin": "",
                "fpr_margin": "",
                "throughput_margin_percent": "",
                "sctr_margin": "",
                "pass": "",
                "log_evidence": "",
            })
            continue

        rs_sorted = sorted(rs, key=lambda r: int(float(r.get("replicate_index", 0) or 0)))

        lat_raw = [float(r.get("p95_detection_latency_ms", 0)) for r in rs_sorted]
        fnr_raw = [float(r.get("false_negative_rate", 0)) for r in rs_sorted]
        fpr_raw = [float(r.get("false_positive_rate", 0)) for r in rs_sorted]
        tpn_raw = [float(r.get("throughput_penalty_percent", 0)) for r in rs_sorted]
        sctr_raw = [float(r.get("safe_state_transition_correct_rate", 0)) for r in rs_sorted]

        lat = _maybe_filter(lat_raw)
        fnr = _maybe_filter(fnr_raw)
        fpr = _maybe_filter(fpr_raw)
        tpn = _maybe_filter(tpn_raw)
        sctr = _maybe_filter(sctr_raw)

        mean_lat = sum(lat) / len(lat)
        mean_fnr = sum(fnr) / len(fnr)
        mean_fpr = sum(fpr) / len(fpr)
        mean_tpn = sum(tpn) / len(tpn)
        mean_sctr = sum(sctr) / len(sctr)

        target_p95 = float(m.get("target_p95_detection_latency_ms", 200))
        target_fnr = float(m.get("target_false_negative_rate", 0.0))
        target_fpr = float(m.get("target_false_positive_rate", 0.005))
        target_tpn = float(m.get("target_throughput_penalty_percent", m.get("budget_percent", 10)))

        pass_flag = (
            mean_lat <= target_p95
            and mean_fnr <= target_fnr
            and mean_fpr <= target_fpr
            and mean_tpn <= target_tpn
            and mean_sctr >= 0.99
        )

        out_rows.append({
            "test_id": tid,
            "budget_percent": m.get("budget_percent", ""),
            "audit_mode": m.get("audit_mode", "monolithic"),
            "filter_mode": FILTER_MODE,
            "filter_alpha": FILTER_ALPHA,
            "workload_profile": m.get("workload_profile", ""),
            "fault_type": m.get("fault_type", ""),
            "runs": len(rs),
            "replicate_count": len(rs),
            "expected_replicates": expected_reps,
            "replicate_coverage": len(rs) >= expected_reps,
            "p95_detection_latency_ms": round(mean_lat, 6),
            "false_negative_rate": round(mean_fnr, 8),
            "false_positive_rate": round(mean_fpr, 8),
            "throughput_penalty_percent": round(mean_tpn, 6),
            "safe_state_transition_correct_rate": round(mean_sctr, 8),
            "p95_detection_latency_ms_p90": round(_percentile(lat, 0.90), 6),
            "p95_detection_latency_ms_p95": round(_percentile(lat, 0.95), 6),
            "p95_detection_latency_ms_worst": round(max(lat), 6),
            "p95_detection_latency_ms_stddev": round(_stddev(lat), 6),
            "p95_detection_latency_ms_cv": round(_cv(lat), 8),
            "false_negative_rate_p90": round(_percentile(fnr, 0.90), 8),
            "false_negative_rate_p95": round(_percentile(fnr, 0.95), 8),
            "false_negative_rate_worst": round(max(fnr), 8),
            "false_negative_rate_stddev": round(_stddev(fnr), 8),
            "false_negative_rate_cv": round(_cv(fnr), 8),
            "false_positive_rate_p90": round(_percentile(fpr, 0.90), 8),
            "false_positive_rate_p95": round(_percentile(fpr, 0.95), 8),
            "false_positive_rate_worst": round(max(fpr), 8),
            "false_positive_rate_stddev": round(_stddev(fpr), 8),
            "false_positive_rate_cv": round(_cv(fpr), 8),
            "throughput_penalty_percent_p90": round(_percentile(tpn, 0.90), 6),
            "throughput_penalty_percent_p95": round(_percentile(tpn, 0.95), 6),
            "throughput_penalty_percent_worst": round(max(tpn), 6),
            "throughput_penalty_percent_stddev": round(_stddev(tpn), 6),
            "throughput_penalty_percent_cv": round(_cv(tpn), 8),
            "safe_state_transition_correct_rate_p10": round(_percentile(sctr, 0.10), 8),
            "safe_state_transition_correct_rate_p05": round(_percentile(sctr, 0.05), 8),
            "safe_state_transition_correct_rate_worst": round(min(sctr), 8),
            "safe_state_transition_correct_rate_stddev": round(_stddev(sctr), 8),
            "safe_state_transition_correct_rate_cv": round(_cv(sctr), 8),
            "latency_margin_ms": round(target_p95 - mean_lat, 6),
            "fnr_margin": round(target_fnr - mean_fnr, 8),
            "fpr_margin": round(target_fpr - mean_fpr, 8),
            "throughput_margin_percent": round(target_tpn - mean_tpn, 6),
            "sctr_margin": round(mean_sctr - 0.99, 8),
            "pass": pass_flag,
            "log_evidence": str(RAW_DIR),
        })

    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()) if out_rows else ["test_id", "pass"])
        w.writeheader()
        if out_rows:
            w.writerows(out_rows)

    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
