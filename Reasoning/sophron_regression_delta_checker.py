#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

BASELINE_MANIFEST = Path("Reasoning/baselines/SOPH-BL-2026-03-15/baseline_lock.json")
CURRENT_COMPARISON = Path("Reasoning/sophron_probe_mode_comparison.csv")
CURRENT_TARGET10 = Path("Reasoning/sophron_probe_target10_check.csv")
SIM_SCRIPT = Path("Reasoning/simulate_probe_mode_raw_runs.py")
OUT = Path("Reasoning/sophron_regression_delta_check.csv")


def _f(v: str | float | int | None, d: float = 0.0) -> float:
    try:
        return float(v)
    except Exception:
        return d


def _b(v: str | bool | None) -> bool:
    return str(v).strip().lower() in {"true", "1", "yes"}


def _read_master_seed(path: Path) -> int | None:
    if not path.exists():
        return None
    text = path.read_text(encoding="utf-8")
    m = re.search(r"^MASTER_SEED\s*=\s*(\d+)", text, re.MULTILINE)
    return int(m.group(1)) if m else None


def _read_chunked10_p95(path: Path) -> float | None:
    if not path.exists():
        return None
    rows = list(csv.DictReader(path.open("r", encoding="utf-8", newline="")))
    for r in rows:
        if (r.get("audit_mode") == "chunked") and int(round(_f(r.get("budget_percent")))) == 10:
            return _f(r.get("mean_p95_ms"), None)
    return None


def _read_target10_summary(path: Path) -> tuple[bool, dict[str, float], dict[str, dict[str, float]]]:
    if not path.exists():
        return False, {}, {}
    rows = list(csv.DictReader(path.open("r", encoding="utf-8", newline="")))
    if not rows:
        return False, {}, {}

    summary = rows[0]
    overall_pass = _b(summary.get("pass"))

    test_rows = [r for r in rows if (r.get("test_id") or "").startswith("PB-C-")]
    if not test_rows:
        return overall_pass, {}, {}

    mins = {
        "latency_margin_ms": min(_f(r.get("latency_margin_ms"), 0.0) for r in test_rows),
        "fpr_margin": min(_f(r.get("fpr_margin"), 0.0) for r in test_rows),
        "throughput_margin_percent": min(_f(r.get("throughput_margin_percent"), 0.0) for r in test_rows),
        "sctr_margin": min(_f(r.get("sctr_margin"), 0.0) for r in test_rows),
    }
    per_test = {
        str(r.get("test_id")): {
            "latency_margin_ms": _f(r.get("latency_margin_ms"), 0.0),
            "fpr_margin": _f(r.get("fpr_margin"), 0.0),
            "throughput_margin_percent": _f(r.get("throughput_margin_percent"), 0.0),
            "sctr_margin": _f(r.get("sctr_margin"), 0.0),
        }
        for r in test_rows
    }
    return overall_pass, mins, per_test


def _shrink_pct(baseline: float, current: float) -> float:
    if baseline <= 0:
        return 0.0
    return ((baseline - current) / baseline) * 100.0


def main() -> None:
    if not BASELINE_MANIFEST.exists():
        OUT.parent.mkdir(parents=True, exist_ok=True)
        with OUT.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["status", "reason", "pass"])
            w.writeheader()
            w.writerow({"status": "FAIL", "reason": "missing_baseline_manifest", "pass": False})
        print(f"Wrote {OUT}")
        print("STATUS=fail")
        return

    baseline = json.loads(BASELINE_MANIFEST.read_text(encoding="utf-8"))

    expected_seed = int(baseline.get("master_seed", -1))
    current_seed = _read_master_seed(SIM_SCRIPT)

    baseline_p95 = _f(baseline.get("chunked10", {}).get("mean_p95_ms"), 0.0)
    current_p95 = _read_chunked10_p95(CURRENT_COMPARISON) or 0.0
    p95_drift_pct = ((current_p95 - baseline_p95) / baseline_p95 * 100.0) if baseline_p95 > 0 else 0.0

    baseline_mins = baseline.get("chunked10", {}).get("min_margins", {})
    baseline_target10_path = Path(baseline.get("artifacts", {}).get("target10_check", ""))
    _, _, baseline_per_test = _read_target10_summary(baseline_target10_path)
    current_pass, current_mins, current_per_test = _read_target10_summary(CURRENT_TARGET10)

    margin_metrics = ["latency_margin_ms", "fpr_margin", "throughput_margin_percent", "sctr_margin"]
    shrink_min = {
        m: _shrink_pct(_f(baseline_mins.get(m), 0.0), _f(current_mins.get(m), 0.0)) for m in margin_metrics
    }
    per_test_shrinks: list[float] = []
    for tid, bvals in baseline_per_test.items():
        cvals = current_per_test.get(tid)
        if not cvals:
            continue
        for m in margin_metrics:
            per_test_shrinks.append(_shrink_pct(_f(bvals.get(m), 0.0), _f(cvals.get(m), 0.0)))

    worst_shrink = max(per_test_shrinks) if per_test_shrinks else (max(shrink_min.values()) if shrink_min else 0.0)

    hard_fail = []
    warnings = []

    if current_seed is None:
        hard_fail.append("master_seed_unreadable")
    elif current_seed != expected_seed:
        hard_fail.append("master_seed_mismatch")

    if not current_pass:
        hard_fail.append("target10_not_passing")

    if p95_drift_pct > 5.0:
        warnings.append("p95_drift_gt_5pct")

    if worst_shrink > 10.0:
        warnings.append("margin_shrink_gt_10pct")

    if hard_fail:
        status = "FAIL"
        pass_flag = False
    elif warnings:
        status = "REGRESSION_WARNING"
        pass_flag = False
    else:
        status = "PASS"
        pass_flag = True

    OUT.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "baseline_id",
        "status",
        "pass",
        "current_target10_pass",
        "baseline_mean_p95_ms",
        "current_mean_p95_ms",
        "p95_drift_pct",
        "baseline_master_seed",
        "current_master_seed",
        "latency_margin_shrink_pct",
        "fpr_margin_shrink_pct",
        "throughput_margin_shrink_pct",
        "sctr_margin_shrink_pct",
        "worst_margin_shrink_pct",
        "warnings",
        "hard_fail_reasons",
    ]

    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerow(
            {
                "baseline_id": baseline.get("baseline_id", "unknown"),
                "status": status,
                "pass": pass_flag,
                "current_target10_pass": current_pass,
                "baseline_mean_p95_ms": round(baseline_p95, 6),
                "current_mean_p95_ms": round(current_p95, 6),
                "p95_drift_pct": round(p95_drift_pct, 6),
                "baseline_master_seed": expected_seed,
                "current_master_seed": current_seed if current_seed is not None else "",
                "latency_margin_shrink_pct": round(shrink_min.get("latency_margin_ms", 0.0), 6),
                "fpr_margin_shrink_pct": round(shrink_min.get("fpr_margin", 0.0), 6),
                "throughput_margin_shrink_pct": round(shrink_min.get("throughput_margin_percent", 0.0), 6),
                "sctr_margin_shrink_pct": round(shrink_min.get("sctr_margin", 0.0), 6),
                "worst_margin_shrink_pct": round(worst_shrink, 6),
                "warnings": "|".join(warnings),
                "hard_fail_reasons": "|".join(hard_fail),
            }
        )

    print(f"Wrote {OUT}")
    print(f"STATUS={status.lower()}")


if __name__ == "__main__":
    main()
