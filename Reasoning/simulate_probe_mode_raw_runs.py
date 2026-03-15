#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import json
import os
import random
from datetime import datetime, timezone
from pathlib import Path

MATRIX = Path("Reasoning/sophron_probe_budget_test_matrix.csv")
OUT = Path("Reasoning/raw/probe_budget_runs/sim_probe_modes_campaign_2026-03-15_tuned.jsonl")
MASTER_SEED = 20260315
DEFAULT_REPLICATES = 30
CHALLENGE_ID = os.getenv("SOPHRON_CHALLENGE_ID", "").strip().upper()
try:
    NOISE_MULTIPLIER = float(os.getenv("SOPHRON_NOISE_MULTIPLIER", "1.0"))
except Exception:
    NOISE_MULTIPLIER = 1.0
NOISE_MULTIPLIER = max(0.1, NOISE_MULTIPLIER)

try:
    CHAL02_BURST_BUDGET_PERCENT = float(os.getenv("SOPHRON_CHAL02_BURST_BUDGET_PERCENT", "0"))
except Exception:
    CHAL02_BURST_BUDGET_PERCENT = 0.0
CHAL02_BURST_BUDGET_PERCENT = max(0.0, CHAL02_BURST_BUDGET_PERCENT)

# Tuned chunked-mode profile for surgical probe budget optimization.
CHUNKED_PROFILE = {
    "window_epochs": 4,
    "chunk_count": 4,
    "lightweight_invariant_split": 0.35,
}


def _seed_for(test_id: str, replicate_index: int) -> int:
    s = f"{MASTER_SEED}|{test_id}|{replicate_index}".encode("utf-8")
    return int(hashlib.sha256(s).hexdigest()[:16], 16)


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def metric_row(budget: int, mode: str, workload: str, fault: str) -> dict:
    # monolithic baseline
    lat = {5: 255, 10: 210, 15: 185, 20: 170, 25: 165}.get(budget, 200)
    fnr = {5: 0.015, 10: 0.006, 15: 0.002, 20: 0.0, 25: 0.0}.get(budget, 0.001)
    fpr = {5: 0.0045, 10: 0.0038, 15: 0.0033, 20: 0.0030, 25: 0.0030}.get(budget, 0.003)
    tpen = {5: 4.5, 10: 9.0, 15: 13.8, 20: 18.8, 25: 23.8}.get(budget, 10)
    sctr = {5: 0.975, 10: 0.985, 15: 0.991, 20: 0.994, 25: 0.995}.get(budget, 0.99)

    # workload/fault stress
    if workload == "bursty":
        lat += 10
    if workload == "adversarial_jitter":
        lat += 16
        fnr += 0.001
    if fault == "semantic_invalid_checksum_valid":
        lat += 8
        fnr += 0.001

    if mode == "chunked":
        w = CHUNKED_PROFILE["window_epochs"]
        k = CHUNKED_PROFILE["chunk_count"]
        inv_split = CHUNKED_PROFILE["lightweight_invariant_split"]

        lat_gain = 52 + max(0, 6 - (w + k)) * 3
        fnr_gain = 0.0085 + max(0.0, 0.40 - inv_split) * 0.01
        sctr_gain = 0.008 + max(0.0, 0.40 - inv_split) * 0.02
        tpen_overhead = 0.45 + inv_split * 0.4

        lat -= lat_gain
        fnr = max(0.0, fnr - fnr_gain)
        sctr = min(0.999, sctr + sctr_gain)
        tpen += tpen_overhead

    return {
        "p95_detection_latency_ms": float(max(80, lat)),
        "false_negative_rate": float(max(0.0, fnr)),
        "false_positive_rate": float(fpr),
        "throughput_penalty_percent": float(tpen),
        "safe_state_transition_correct_rate": float(min(1.0, sctr)),
    }


def build_stress_burst_map(rows: list[dict[str, str]]) -> dict[str, dict[str, float]]:
    ids = [r["test_id"].strip() for r in rows]
    idx = {tid: i for i, tid in enumerate(ids)}
    rng = random.Random(MASTER_SEED ^ 0xBADA55)
    burst = {tid: 0.0 for tid in ids}

    for tid in ids:
        if rng.random() < 0.18:
            center = idx[tid]
            amp = rng.uniform(0.35, 1.0)
            for off, decay in [(-1, 0.55), (0, 1.0), (1, 0.55)]:
                j = center + off
                if 0 <= j < len(ids):
                    burst[ids[j]] = max(burst[ids[j]], amp * decay)

    return {
        tid: {
            "active": bool(v > 0.0),
            "severity": round(v, 4),
            "profile": "adjacent_correlated_burst" if v > 0 else "nominal_noise",
        }
        for tid, v in burst.items()
    }


def apply_noise(base: dict[str, float], noise_rng: random.Random, workload: str, burst_severity: float) -> tuple[dict[str, float], dict[str, float | bool | str]]:
    workload_scale = {
        "nominal": 0.85,
        "bursty": 1.1,
        "adversarial_jitter": 1.35,
    }.get(workload, 1.0)

    stress = 1.0 + burst_severity
    is_outlier = noise_rng.random() < (0.03 + 0.04 * burst_severity)

    sigma_scale = NOISE_MULTIPLIER

    lat = base["p95_detection_latency_ms"] * (1.0 + noise_rng.gauss(0.0, 0.035 * workload_scale * stress * sigma_scale))
    fpr = base["false_positive_rate"] * (1.0 + noise_rng.gauss(0.0, 0.08 * workload_scale * stress * sigma_scale))
    tpen = base["throughput_penalty_percent"] * (1.0 + noise_rng.gauss(0.0, 0.03 * workload_scale * stress * sigma_scale))

    # Keep zero-FNR operating points stable while still adding realistic variability when non-zero.
    fnr = base["false_negative_rate"] * max(0.0, (1.0 + noise_rng.gauss(0.0, 0.12 * workload_scale * stress * sigma_scale)))
    sctr = base["safe_state_transition_correct_rate"] + noise_rng.gauss(0.0, 0.0012 * workload_scale * stress * sigma_scale)

    if is_outlier:
        lat *= noise_rng.uniform(1.04, 1.14)
        fpr *= noise_rng.uniform(1.05, 1.22)
        tpen *= noise_rng.uniform(1.03, 1.14)
        if base["false_negative_rate"] > 0:
            fnr *= noise_rng.uniform(1.05, 1.3)
        sctr -= noise_rng.uniform(0.001, 0.004)

    noisy = {
        "p95_detection_latency_ms": round(_clamp(lat, 80.0, 500.0), 3),
        "false_negative_rate": round(_clamp(fnr, 0.0, 1.0), 6),
        "false_positive_rate": round(_clamp(fpr, 0.0, 1.0), 6),
        "throughput_penalty_percent": round(_clamp(tpen, 0.0, 100.0), 3),
        "safe_state_transition_correct_rate": round(_clamp(sctr, 0.94, 1.0), 6),
    }

    noise_meta = {
        "noise_profile": "stochastic_jitter_with_bursts",
        "noise_multiplier": round(NOISE_MULTIPLIER, 3),
        "workload_scale": round(workload_scale, 3),
        "burst_severity": round(burst_severity, 4),
        "outlier_applied": is_outlier,
    }
    return noisy, noise_meta


def apply_challenge_drift(noisy: dict[str, float], *, test_id: str, mode: str, budget: int, replicate_index: int, replicates_expected: int) -> tuple[dict[str, float], dict[str, float | str | bool]]:
    meta: dict[str, float | str | bool] = {"challenge_id": CHALLENGE_ID or "NONE", "challenge_applied": False}
    if CHALLENGE_ID != "CHAL-01":
        return noisy, meta

    # CHAL-01: subtle slow-walking drift targeting chunked@10 lanes.
    # Approximation: +0.44ms per replicate (~+6.82ms mean over 30 reps),
    # intended to trigger REGRESSION_WARNING via margin shrink without hard FAIL.
    if mode == "chunked" and budget == 10 and test_id.startswith("PB-C-") and test_id != "PB-C-010":
        drift_ms = 0.44 * float(replicate_index)
        noisy = dict(noisy)
        noisy["p95_detection_latency_ms"] = round(_clamp(noisy["p95_detection_latency_ms"] + drift_ms, 80.0, 500.0), 3)
        meta = {
            "challenge_id": CHALLENGE_ID,
            "challenge_applied": True,
            "drift_profile": "slow_walk_latency",
            "drift_ms": round(drift_ms, 3),
            "replicate_index": replicate_index,
            "replicates_expected": replicates_expected,
        }
    return noisy, meta


def main() -> None:
    rows = list(csv.DictReader(MATRIX.open("r", encoding="utf-8", newline="")))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    burst_map = build_stress_burst_map(rows)

    with OUT.open("w", encoding="utf-8") as f:
        for r in rows:
            tid = r["test_id"].strip()
            budget = int(float(r.get("budget_percent", "0")))
            mode = (r.get("audit_mode") or "monolithic").strip()
            effective_budget = budget
            if CHALLENGE_ID.startswith("CHAL-02") and CHAL02_BURST_BUDGET_PERCENT > 0 and mode == "chunked" and budget == 10 and tid.startswith("PB-C-"):
                effective_budget = int(round(CHAL02_BURST_BUDGET_PERCENT))
            workload = (r.get("workload_profile") or "nominal").strip()
            fault = (r.get("fault_type") or "none").strip()
            reps = int(float(r.get("replicates") or DEFAULT_REPLICATES))
            base = metric_row(effective_budget, mode, workload, fault)

            for i in range(reps):
                rep_idx = i + 1
                seed = _seed_for(tid, rep_idx)
                rng = random.Random(seed)
                burst = burst_map.get(tid, {"severity": 0.0, "profile": "nominal_noise", "active": False})
                noisy, noise_meta = apply_noise(base, rng, workload, float(burst.get("severity", 0.0)))
                noisy, challenge_meta = apply_challenge_drift(
                    noisy,
                    test_id=tid,
                    mode=mode,
                    budget=budget,
                    replicate_index=rep_idx,
                    replicates_expected=reps,
                )
                rec = {
                    "timestamp_utc": ts,
                    "source_type": "sim",
                    "run_id": f"SIM-{tid}-R{rep_idx}",
                    "test_id": tid,
                    "campaign_id": f"PB-CAM-{tid}",
                    "replicate_index": rep_idx,
                    "replicates_expected": reps,
                    "effective_budget_percent": effective_budget,
                    **noisy,
                    "chunked_profile": CHUNKED_PROFILE if mode == "chunked" else {},
                    "noise_metadata": {
                        "master_seed": MASTER_SEED,
                        "replicate_seed": seed,
                        "burst_profile": burst,
                        "burst_budget_percent": effective_budget,
                        **noise_meta,
                        **challenge_meta,
                    },
                    "log_evidence": f"Reasoning/logs/sim_{tid.lower()}_r{rep_idx:02d}.json",
                }
                f.write(json.dumps(rec) + "\n")

    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
