#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

CAMPAIGN = Path("Reasoning/sophron_skew_injection_campaign.csv")
OUT_DIR = Path("Reasoning/raw/skew_runs")
OUT_FILE = OUT_DIR / "skew_campaign_stubs.jsonl"


def main() -> None:
    if not CAMPAIGN.exists():
        raise FileNotFoundError(CAMPAIGN)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    rows = []
    with CAMPAIGN.open("r", encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            cid = (r.get("campaign_id") or "").strip()
            ts = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
            # map coarse campaigns to existing SK-* ids when possible by skew bucket; fallback to campaign id
            skew = float((r.get("skew_ms") or "0").strip())
            if skew <= 6:
                test_id = "SK-001"
            elif skew <= 12:
                test_id = "SK-002"
            elif skew <= 22:
                test_id = "SK-003"
            elif skew <= 40:
                test_id = "SK-004"
            else:
                test_id = "SK-005"

            rec = {
                "timestamp_utc": ts,
                "source_type": "sim",
                "run_id": f"SIM-SKEW-{cid}-R001",
                "test_id": test_id,
                "campaign_id": cid,
                "workload_profile": r.get("workload_profile", ""),
                "pretrigger_profile": r.get("pretrigger_profile", ""),
                "skew_ms": float(r.get("skew_ms", 0) or 0),
                "jitter_ms": float(r.get("jitter_ms", 0) or 0),
                "packet_loss_pct": float(r.get("packet_loss_pct", 0) or 0),
                "observed_false_negative_rate": "",
                "observed_false_positive_rate": "",
                "observed_p95_detection_latency_ms": "",
                "observed_safe_state_correct_rate": "",
                "detector_evidence": [],
                "log_evidence": "",
                "notes": "stub generated from campaign; fill observed metrics and evidence",
            }
            rows.append(rec)

    with OUT_FILE.open("w", encoding="utf-8") as f:
        for rec in rows:
            f.write(json.dumps(rec) + "\n")

    print(f"Wrote {OUT_FILE}")
    print(f"STUBS={len(rows)}")


if __name__ == "__main__":
    main()
