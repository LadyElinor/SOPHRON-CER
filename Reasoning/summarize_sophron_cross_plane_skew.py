#!/usr/bin/env python3
from __future__ import annotations

import csv
from pathlib import Path

MATRIX = Path("Reasoning/sophron_cross_plane_skew_test_matrix.csv")
RESULTS = Path("Reasoning/sophron_cross_plane_skew_results.csv")
SUMMARY = Path("Reasoning/sophron_cross_plane_skew_summary.md")


def _f(v: str, d: float = 0.0) -> float:
    try:
        return float((v or "").strip())
    except Exception:
        return d


def _b(v: str) -> bool:
    return str(v).strip().lower() in {"true", "1", "yes"}


def _norm(v: str) -> str:
    return (v or "").strip().lower()


def main() -> None:
    with MATRIX.open("r", encoding="utf-8", newline="") as f:
        mrows = list(csv.DictReader(f))
    with RESULTS.open("r", encoding="utf-8", newline="") as f:
        rrows = list(csv.DictReader(f))

    rmap = {(r.get("test_id") or "").strip(): r for r in rrows if (r.get("test_id") or "").strip()}

    lines = [
        "# SOPHRON-1 Cross-Plane Skew Summary",
        "",
        "| Test | skew_ms | jitter_ms | loss% | expected | observed | pass |",
        "|---|---:|---:|---:|---|---|---|",
    ]

    max_passing_skew = None
    for m in mrows:
        tid = m["test_id"].strip()
        rr = rmap.get(tid, {})
        expected = _norm(m.get("expected_result"))
        pass_bool = _b(rr.get("pass", "False"))
        observed = "pass" if pass_bool else "reject"
        lines.append(f"| {tid} | {_f(m.get('skew_ms')):.1f} | {_f(m.get('jitter_ms')):.1f} | {_f(m.get('packet_loss_pct')):.1f} | {expected} | {observed} | {pass_bool} |")
        if pass_bool:
            sk = _f(m.get("skew_ms"))
            max_passing_skew = sk if max_passing_skew is None else max(max_passing_skew, sk)

    lines.extend([
        "",
        "## Derived tolerance",
        f"- max passing skew (ms): `{max_passing_skew if max_passing_skew is not None else 'none'}`",
        "",
    ])

    SUMMARY.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {SUMMARY}")


if __name__ == "__main__":
    main()
