#!/usr/bin/env python3
from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path

INPUT = Path("Reasoning/uncertainty_ledger_sophron1.csv")
OUT = Path("Reasoning/uncertainty_ledger_check_sophron1.csv")
MAX_STALE_DAYS = 14


def _parse_iso(v: str) -> datetime | None:
    s = (v or "").strip()
    if not s:
        return None
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


def main() -> None:
    if not INPUT.exists():
        raise FileNotFoundError(INPUT)

    with INPUT.open("r", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    now = datetime.now(timezone.utc)
    out_rows = []
    overall = True

    for r in rows:
        item_id = (r.get("item_id") or "").strip()
        bucket = (r.get("bucket") or "").strip().lower()
        impact = (r.get("impact") or "").strip().lower()
        owner = (r.get("owner") or "").strip().lower()
        nxt = (r.get("next_measurement") or "").strip()
        lu = _parse_iso(r.get("last_updated_utc") or "")
        stale = (lu is None) or (((now - lu).total_seconds() / 86400.0) > MAX_STALE_DAYS)

        high_unknown = bucket == "unknown" and impact == "high"
        owner_ok = bool(owner and owner != "unassigned")
        next_ok = bool(nxt)
        row_pass = (not stale) and (not high_unknown or (owner_ok and next_ok))
        overall = overall and row_pass

        out_rows.append({
            "item_id": item_id,
            "high_impact_unknown": high_unknown,
            "owner_ok": owner_ok,
            "next_measurement_ok": next_ok,
            "stale": stale,
            "pass": row_pass,
        })

    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()) if out_rows else ["item_id", "pass"])
        w.writeheader()
        if out_rows:
            w.writerows(out_rows)

    print(f"Wrote {OUT}")
    print(f"STATUS={'pass' if overall else 'fail'}")


if __name__ == "__main__":
    main()
