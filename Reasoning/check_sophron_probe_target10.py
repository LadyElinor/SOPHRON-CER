#!/usr/bin/env python3
from __future__ import annotations

import csv
from pathlib import Path

RESULTS = Path("Reasoning/sophron_probe_budget_results.csv")
OUT = Path("Reasoning/sophron_probe_target10_check.csv")
TARGET_IDS = ["PB-C-006", "PB-C-007", "PB-C-008", "PB-C-009", "PB-C-010"]

# Robustness policy for TARGET10 chunked runs.
MIN_LATENCY_MARGIN_MS = 8.0
MIN_FPR_MARGIN = 0.00035
MIN_TPEN_MARGIN = 0.2
MIN_SCTR_MARGIN = 0.0035
MAX_LATENCY_CV = 0.08
MAX_TPEN_CV = 0.06
MAX_FPR_CV = 0.24
MAX_SCTR_STDDEV = 0.0035
MAX_LATENCY_P95_OVER_TARGET_MS = 5.0
MAX_FPR_P95_OVER_TARGET = 0.0
MAX_TPEN_P95_OVER_TARGET = 0.5
MIN_SCTR_P05 = 0.99


def _b(v: str) -> bool:
    return str(v).strip().lower() in {"true", "1", "yes"}


def _f(v: str, d: float = 0.0) -> float:
    try:
        return float((v or "").strip())
    except Exception:
        return d


def main() -> None:
    rows = list(csv.DictReader(RESULTS.open("r", encoding="utf-8", newline="")))
    by_id = {r.get("test_id", "").strip(): r for r in rows}

    detail_rows = []
    all_rows_present = all(tid in by_id for tid in TARGET_IDS)
    overall_pass = all_rows_present

    for tid in TARGET_IDS:
        r = by_id.get(tid, {})
        expected_reps = int(round(_f(r.get("expected_replicates"), 0)))
        rep_count = int(round(_f(r.get("replicate_count"), 0)))
        replicate_coverage = _b(r.get("replicate_coverage", "False")) and rep_count >= expected_reps > 0
        core_threshold_pass = _b(r.get("pass", "False"))

        latency_margin = _f(r.get("latency_margin_ms"))
        fpr_margin = _f(r.get("fpr_margin"))
        tpen_margin = _f(r.get("throughput_margin_percent"))
        sctr_margin = _f(r.get("sctr_margin"))

        margin_pass = (
            latency_margin >= MIN_LATENCY_MARGIN_MS
            and fpr_margin >= MIN_FPR_MARGIN
            and tpen_margin >= MIN_TPEN_MARGIN
            and sctr_margin >= MIN_SCTR_MARGIN
        )

        latency_cv = _f(r.get("p95_detection_latency_ms_cv"))
        tpen_cv = _f(r.get("throughput_penalty_percent_cv"))
        fpr_cv = _f(r.get("false_positive_rate_cv"))
        sctr_std = _f(r.get("safe_state_transition_correct_rate_stddev"))
        stability_pass = (
            latency_cv <= MAX_LATENCY_CV
            and tpen_cv <= MAX_TPEN_CV
            and fpr_cv <= MAX_FPR_CV
            and sctr_std <= MAX_SCTR_STDDEV
        )

        # Tail envelope checks using aggregate p95/p05 columns.
        target_lat = 200.0
        target_fpr = 0.005
        target_tpen = _f(r.get("budget_percent"), 10.0)

        lat_p95 = _f(r.get("p95_detection_latency_ms_p95"))
        fpr_p95 = _f(r.get("false_positive_rate_p95"))
        tpen_p95 = _f(r.get("throughput_penalty_percent_p95"))
        sctr_p05 = _f(r.get("safe_state_transition_correct_rate_p05"))

        tail_pass = (
            lat_p95 <= (target_lat + MAX_LATENCY_P95_OVER_TARGET_MS)
            and fpr_p95 <= (target_fpr + MAX_FPR_P95_OVER_TARGET)
            and tpen_p95 <= (target_tpen + MAX_TPEN_P95_OVER_TARGET)
            and sctr_p05 >= MIN_SCTR_P05
        )

        row_pass = replicate_coverage and core_threshold_pass and margin_pass and stability_pass and tail_pass
        overall_pass = overall_pass and row_pass

        detail_rows.append({
            "test_id": tid,
            "replicate_count": rep_count,
            "expected_replicates": expected_reps,
            "replicate_coverage": replicate_coverage,
            "core_threshold_pass": core_threshold_pass,
            "margin_pass": margin_pass,
            "stability_pass": stability_pass,
            "tail_pass": tail_pass,
            "latency_margin_ms": round(latency_margin, 6),
            "fpr_margin": round(fpr_margin, 8),
            "throughput_margin_percent": round(tpen_margin, 6),
            "sctr_margin": round(sctr_margin, 8),
            "latency_cv": round(latency_cv, 8),
            "throughput_cv": round(tpen_cv, 8),
            "fpr_cv": round(fpr_cv, 8),
            "sctr_stddev": round(sctr_std, 8),
            "latency_p95": round(lat_p95, 6),
            "fpr_p95": round(fpr_p95, 8),
            "throughput_p95": round(tpen_p95, 6),
            "sctr_p05": round(sctr_p05, 8),
            "pass": row_pass,
        })

    summary = {
        "rows_expected": len(TARGET_IDS),
        "rows_found": len(detail_rows),
        "complete": all_rows_present,
        "all_pass": all(r["pass"] for r in detail_rows) if detail_rows else False,
        "pass": overall_pass,
        "criteria": "replicate_coverage + core_threshold + safety_margin + stability_caps + tail_envelope",
    }

    with OUT.open("w", encoding="utf-8", newline="") as f:
        fieldnames = list(summary.keys()) + list(detail_rows[0].keys())
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        # summary row
        w.writerow({**summary})
        for r in detail_rows:
            w.writerow(r)

    print(f"Wrote {OUT}")
    print(f"STATUS={'pass' if overall_pass else 'fail'}")


if __name__ == "__main__":
    main()
