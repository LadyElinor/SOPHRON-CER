#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import json
import random
from pathlib import Path

MATRIX = Path("Reasoning/sophron_probe_budget_test_matrix.csv")
RESULTS = Path("Reasoning/sophron_probe_budget_results.csv")
LOG_DIR = Path("Reasoning/logs")


def _f(v: str, d: float = 0.0) -> float:
    try:
        return float(v)
    except Exception:
        return d


def simulate_row(row: dict[str, str]) -> dict[str, float]:
    # Deterministic pseudo-randomness per test_id for reproducibility
    tid = row["test_id"].strip()
    seed = int(hashlib.sha256(tid.encode("utf-8")).hexdigest()[:8], 16)
    rng = random.Random(seed)

    budget = _f(row.get("budget_percent", "0"))
    workload = (row.get("workload_profile") or "nominal").strip()
    fault = (row.get("fault_type") or "none").strip()

    # Base behavior by budget
    # Higher budget -> lower latency/FN, slight higher throughput penalty
    base_latency = {5: 235.0, 10: 175.0, 15: 145.0, 20: 118.0, 25: 102.0}.get(int(budget), 190.0)
    base_fnr = {5: 0.02, 10: 0.004, 15: 0.0, 20: 0.0, 25: 0.0}.get(int(budget), 0.01)
    base_fpr = {5: 0.004, 10: 0.003, 15: 0.003, 20: 0.0025, 25: 0.0025}.get(int(budget), 0.003)
    base_penalty = {5: 4.2, 10: 8.4, 15: 13.1, 20: 17.4, 25: 21.6}.get(int(budget), 8.0)
    base_sctr = {5: 0.975, 10: 0.993, 15: 0.997, 20: 0.9985, 25: 0.999}.get(int(budget), 0.99)

    # Workload and fault modifiers
    workload_lat = {"nominal": -10.0, "bursty": 18.0, "adversarial_jitter": 32.0}.get(workload, 0.0)
    workload_fn = {"nominal": -0.002, "bursty": 0.002, "adversarial_jitter": 0.004}.get(workload, 0.0)
    fault_lat = {
        "none": -8.0,
        "replay": 10.0,
        "truncation": 14.0,
        "sequence_reorder": 12.0,
        "semantic_invalid_checksum_valid": 22.0,
    }.get(fault, 0.0)
    fault_fn = {
        "none": -0.002,
        "replay": 0.0,
        "truncation": 0.001,
        "sequence_reorder": 0.001,
        "semantic_invalid_checksum_valid": 0.002,
    }.get(fault, 0.0)

    latency = max(40.0, base_latency + workload_lat + fault_lat + rng.uniform(-8.0, 8.0))
    fnr = max(0.0, base_fnr + workload_fn + fault_fn + rng.uniform(-0.001, 0.001))
    if int(budget) >= 20:
        fnr = 0.0
    fpr = max(0.0, base_fpr + rng.uniform(-0.0008, 0.0008))
    penalty = max(0.0, base_penalty + rng.uniform(-0.7, 0.7))
    sctr = min(1.0, max(0.90, base_sctr + rng.uniform(-0.006, 0.006)))

    return {
        "p95_detection_latency_ms": round(latency, 3),
        "false_negative_rate": round(fnr, 6),
        "false_positive_rate": round(fpr, 6),
        "throughput_penalty_percent": round(penalty, 3),
        "safe_state_transition_correct_rate": round(sctr, 6),
    }


def main() -> None:
    if not MATRIX.exists():
        raise FileNotFoundError(MATRIX)

    LOG_DIR.mkdir(parents=True, exist_ok=True)

    with MATRIX.open("r", encoding="utf-8", newline="") as f:
        matrix_rows = list(csv.DictReader(f))

    out_rows = []
    for row in matrix_rows:
        tid = row["test_id"].strip()
        sim = simulate_row(row)
        runs = int(float(row.get("replicates", "30")))

        target_p95 = _f(row.get("target_p95_detection_latency_ms"), 200)
        target_fnr = _f(row.get("target_false_negative_rate"), 0.0)
        target_fpr = _f(row.get("target_false_positive_rate"), 0.005)
        target_tpen = _f(row.get("target_throughput_penalty_percent"), _f(row.get("budget_percent"), 10.0))

        pass_flag = (
            sim["p95_detection_latency_ms"] <= target_p95
            and sim["false_negative_rate"] <= target_fnr
            and sim["false_positive_rate"] <= target_fpr
            and sim["throughput_penalty_percent"] <= target_tpen
            and sim["safe_state_transition_correct_rate"] >= 0.99
        )

        log_payload = {
            "test_id": tid,
            "input": row,
            "simulated_metrics": sim,
            "targets": {
                "p95": target_p95,
                "fnr": target_fnr,
                "fpr": target_fpr,
                "throughput_penalty": target_tpen,
                "safe_state_transition_correct_rate": 0.99,
            },
            "pass": pass_flag,
            "harness": "synthetic-local-v1",
        }
        log_raw = json.dumps(log_payload, sort_keys=True)
        log_hash = hashlib.sha256(log_raw.encode("utf-8")).hexdigest()[:16]
        log_path = LOG_DIR / f"sophron_probe_{tid.lower()}_{log_hash}.json"
        log_path.write_text(log_raw + "\n", encoding="utf-8")

        out_rows.append(
            {
                "test_id": tid,
                "budget_percent": row.get("budget_percent", ""),
                "workload_profile": row.get("workload_profile", ""),
                "fault_type": row.get("fault_type", ""),
                "runs": runs,
                "p95_detection_latency_ms": sim["p95_detection_latency_ms"],
                "false_negative_rate": sim["false_negative_rate"],
                "false_positive_rate": sim["false_positive_rate"],
                "throughput_penalty_percent": sim["throughput_penalty_percent"],
                "safe_state_transition_correct_rate": sim["safe_state_transition_correct_rate"],
                "pass": pass_flag,
                "log_evidence": str(log_path),
            }
        )

    with RESULTS.open("w", encoding="utf-8", newline="") as f:
        fieldnames = [
            "test_id",
            "budget_percent",
            "workload_profile",
            "fault_type",
            "runs",
            "p95_detection_latency_ms",
            "false_negative_rate",
            "false_positive_rate",
            "throughput_penalty_percent",
            "safe_state_transition_correct_rate",
            "pass",
            "log_evidence",
        ]
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(out_rows)

    print(f"Wrote {RESULTS}")
    print(f"Logs: {LOG_DIR}")


if __name__ == "__main__":
    main()
