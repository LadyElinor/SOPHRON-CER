#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
from pathlib import Path

MATRIX = Path("Reasoning/sophron_audit_attack_matrix.csv")
RAW_DIR = Path("Reasoning/raw/audit_attack_runs")
OUT = Path("Reasoning/sophron_audit_attack_results.csv")


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    expected = {}
    with MATRIX.open("r", encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            expected[(r.get("attack_id") or "").strip()] = (r.get("expected_result") or "reject").strip().lower()

    latest = {}
    for p in RAW_DIR.glob("*.jsonl"):
        for line in p.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            rec = json.loads(line)
            aid = str(rec.get("attack_id", "")).strip()
            if aid:
                latest[aid] = rec

    rows = []
    for aid, exp in sorted(expected.items()):
        rec = latest.get(aid)
        if rec is None:
            rows.append({"attack_id": aid, "expected_result": exp, "observed_result": "", "detector_evidence": "", "log_evidence": "", "notes": "", "pass": ""})
            continue
        obs = str(rec.get("observed_result", "")).strip().lower()
        det = rec.get("detector_evidence", "")
        note = f"source_type={rec.get('source_type', 'unknown')}"
        rows.append({"attack_id": aid, "expected_result": exp, "observed_result": obs, "detector_evidence": det, "log_evidence": str(RAW_DIR), "notes": note, "pass": obs == exp})

    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else ["attack_id", "pass"])
        w.writeheader()
        if rows:
            w.writerows(rows)

    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
