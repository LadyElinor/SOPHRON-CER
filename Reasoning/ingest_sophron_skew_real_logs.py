#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
from pathlib import Path

MATRIX = Path("Reasoning/sophron_cross_plane_skew_test_matrix.csv")
RAW_DIR = Path("Reasoning/raw/skew_runs")
OUT = Path("Reasoning/sophron_cross_plane_skew_results.csv")


def _to_float(v):
    try:
        s = str(v).strip()
        if s == "":
            return None
        return float(s)
    except Exception:
        return None


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    by_test = {}
    for p in RAW_DIR.glob("*.jsonl"):
        for line in p.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            rec = json.loads(line)
            tid = str(rec.get("test_id", "")).strip()
            # ignore stubs/incomplete rows with blank observed metrics
            required_numeric = [
                _to_float(rec.get("observed_false_negative_rate")),
                _to_float(rec.get("observed_false_positive_rate")),
                _to_float(rec.get("observed_p95_detection_latency_ms")),
                _to_float(rec.get("observed_safe_state_correct_rate")),
            ]
            if tid and all(v is not None for v in required_numeric):
                by_test.setdefault(tid, []).append(rec)

    with MATRIX.open("r", encoding="utf-8", newline="") as f:
        mrows = list(csv.DictReader(f))

    out_rows = []
    for m in mrows:
        tid = m["test_id"].strip()
        rs = by_test.get(tid, [])
        if not rs:
            out_rows.append({"test_id": tid, "source_type": m.get("source_type", "sim"), "runs": "", "observed_false_negative_rate": "", "observed_false_positive_rate": "", "observed_p95_detection_latency_ms": "", "observed_safe_state_correct_rate": "", "log_evidence": "", "pass": ""})
            continue

        fnr = sum(float(r.get("observed_false_negative_rate", 0)) for r in rs) / len(rs)
        fpr = sum(float(r.get("observed_false_positive_rate", 0)) for r in rs) / len(rs)
        p95 = sum(float(r.get("observed_p95_detection_latency_ms", 0)) for r in rs) / len(rs)
        sct = sum(float(r.get("observed_safe_state_correct_rate", 0)) for r in rs) / len(rs)

        t_fnr = float(m.get("target_false_negative_rate", 0.0))
        t_fpr = float(m.get("target_false_positive_rate", 0.005))
        t_p95 = float(m.get("target_p95_detection_latency_ms", 200))
        t_sct = float(m.get("target_safe_state_correct_rate", 0.99))
        pass_flag = fnr <= t_fnr and fpr <= t_fpr and p95 <= t_p95 and sct >= t_sct

        out_rows.append({
            "test_id": tid,
            "source_type": m.get("source_type", "sim"),
            "runs": len(rs),
            "observed_false_negative_rate": round(fnr, 8),
            "observed_false_positive_rate": round(fpr, 8),
            "observed_p95_detection_latency_ms": round(p95, 6),
            "observed_safe_state_correct_rate": round(sct, 8),
            "log_evidence": str(RAW_DIR),
            "pass": pass_flag,
        })

    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()) if out_rows else ["test_id", "pass"])
        w.writeheader()
        if out_rows:
            w.writerows(out_rows)

    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
