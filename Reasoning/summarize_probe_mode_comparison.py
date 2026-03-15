#!/usr/bin/env python3
from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

RESULTS = Path("Reasoning/sophron_probe_budget_results.csv")
OUT_MD = Path("Reasoning/sophron_probe_mode_comparison.md")
OUT_CSV = Path("Reasoning/sophron_probe_mode_comparison.csv")


def _f(v: str, d: float = 0.0) -> float:
    try:
        return float((v or "").strip())
    except Exception:
        return d


def _b(v: str) -> bool:
    return str(v).strip().lower() in {"true", "1", "yes"}


def main() -> None:
    rows = list(csv.DictReader(RESULTS.open("r", encoding="utf-8", newline="")))
    agg = defaultdict(list)
    for r in rows:
        mode = (r.get("audit_mode") or "monolithic").strip()
        b = int(round(_f(r.get("budget_percent"), 0)))
        agg[(mode, b)].append(r)

    out_rows = []
    for (mode, b), rs in sorted(agg.items(), key=lambda x: (x[0][1], x[0][0])):
        if not rs:
            continue
        out_rows.append({
            "audit_mode": mode,
            "budget_percent": b,
            "rows": len(rs),
            "pass_rows": sum(1 for r in rs if _b(r.get("pass", "False"))),
            "mean_p95_ms": round(sum(_f(r.get("p95_detection_latency_ms")) for r in rs) / len(rs), 3),
            "mean_fnr": round(sum(_f(r.get("false_negative_rate")) for r in rs) / len(rs), 6),
            "mean_tpen": round(sum(_f(r.get("throughput_penalty_percent")) for r in rs) / len(rs), 3),
            "mean_latency_cv": round(sum(_f(r.get("p95_detection_latency_ms_cv")) for r in rs) / len(rs), 6),
            "mean_fpr_p95": round(sum(_f(r.get("false_positive_rate_p95")) for r in rs) / len(rs), 6),
            "min_latency_margin_ms": round(min(_f(r.get("latency_margin_ms")) for r in rs), 3),
            "min_tpen_margin_percent": round(min(_f(r.get("throughput_margin_percent")) for r in rs), 3),
            "replicate_coverage_rows": sum(1 for r in rs if _b(r.get("replicate_coverage", "False"))),
        })

    with OUT_CSV.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()) if out_rows else ["audit_mode", "budget_percent"])
        w.writeheader()
        if out_rows:
            w.writerows(out_rows)

    def find(mode: str, budget: int):
        for r in out_rows:
            if r["audit_mode"] == mode and r["budget_percent"] == budget:
                return r
        return None

    c10 = find("chunked", 10)
    m25 = find("monolithic", 25)

    lines = [
        "# SOPHRON Probe Mode Comparison",
        "",
        "| mode | budget | pass_rows/rows | mean p95 (ms) | mean fnr | mean throughput penalty | mean latency CV | min latency margin (ms) |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for r in out_rows:
        lines.append(
            f"| {r['audit_mode']} | {r['budget_percent']} | {r['pass_rows']}/{r['rows']} | {r['mean_p95_ms']} | {r['mean_fnr']} | {r['mean_tpen']} | {r['mean_latency_cv']} | {r['min_latency_margin_ms']} |"
        )

    lines.extend(["", "## Bridge comparator", ""])
    if c10 and m25:
        lines.append(f"- chunked@10 pass_rows: {c10['pass_rows']}/{c10['rows']} (coverage rows {c10['replicate_coverage_rows']})")
        lines.append(f"- monolithic@25 pass_rows: {m25['pass_rows']}/{m25['rows']} (coverage rows {m25['replicate_coverage_rows']})")
        better = "chunked@10" if c10["pass_rows"] >= m25["pass_rows"] else "monolithic@25"
        lines.append(f"- comparator winner (by pass_rows): **{better}**")
        lines.append(f"- robustness: chunked@10 min latency margin={c10['min_latency_margin_ms']} ms, mean latency CV={c10['mean_latency_cv']}")
    else:
        lines.append("- insufficient rows for chunked@10 vs monolithic@25 comparison")

    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_CSV}")
    print(f"Wrote {OUT_MD}")


if __name__ == "__main__":
    main()
