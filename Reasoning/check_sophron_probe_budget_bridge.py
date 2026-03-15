#!/usr/bin/env python3
from __future__ import annotations

import csv
from pathlib import Path

RESULTS = Path("Reasoning/sophron_probe_budget_results.csv")
OUT = Path("Reasoning/sophron_probe_budget_bridge_check.csv")
CHALLENGE_ROOT = Path("Reasoning/challenges")
ELASTIC_BUDGETS = [15, 18, 20]
TARGET_IDS = ["PB-C-006", "PB-C-007", "PB-C-008", "PB-C-009", "PB-C-010"]


def _b(v: str) -> bool:
    return str(v).strip().lower() in {"true", "1", "yes"}


def _f(v: str, d: float = 0.0) -> float:
    try:
        return float((v or "").strip())
    except Exception:
        return d


def _target10_pass_from(path: Path) -> bool | None:
    if not path.exists():
        return None
    rows = list(csv.DictReader(path.open("r", encoding="utf-8", newline="")))
    if not rows:
        return None
    return _b(rows[0].get("pass", "False"))


def _reg_status_from(path: Path) -> str | None:
    if not path.exists():
        return None
    rows = list(csv.DictReader(path.open("r", encoding="utf-8", newline="")))
    if not rows:
        return None
    return str(rows[0].get("status", "")).strip().upper() or None


def _extract_target_rows(results_rows: list[dict[str, str]]) -> list[dict[str, str]]:
    targets = [
        r for r in results_rows
        if (r.get("test_id") or "") in TARGET_IDS
        and int(round(_f(r.get("budget_percent"), 0))) == 10
        and (r.get("audit_mode") or "") == "chunked"
    ]
    return sorted(targets, key=lambda r: r.get("test_id", ""))


def _passes_with_budget(rows: list[dict[str, str]], budget_percent: int) -> bool:
    if len(rows) != len(TARGET_IDS):
        return False
    for r in rows:
        if _f(r.get("p95_detection_latency_ms"), 1e9) > 200.0:
            return False
        if _f(r.get("false_negative_rate"), 1.0) > 0.0:
            return False
        if _f(r.get("false_positive_rate"), 1.0) > 0.005:
            return False
        if _f(r.get("throughput_penalty_percent"), 1e9) > float(budget_percent):
            return False
        if _f(r.get("safe_state_transition_correct_rate"), 0.0) < 0.99:
            return False
    return True


def _baseline_static_pass(results_rows: list[dict[str, str]]) -> bool:
    # Use robust TARGET10 gate when available; fallback to core-threshold check.
    current_target10 = _target10_pass_from(Path("Reasoning/sophron_probe_target10_check.csv"))
    if current_target10 is not None:
        return bool(current_target10)
    return _passes_with_budget(_extract_target_rows(results_rows), 10)


def main() -> None:
    if not RESULTS.exists():
        raise FileNotFoundError(RESULTS)

    rows = list(csv.DictReader(RESULTS.open("r", encoding="utf-8", newline="")))
    static_pass = _baseline_static_pass(rows)

    lowest_passing_budget = ""
    elastic_pass = False
    elastic_status = "FAIL"
    examined = []

    for b in ELASTIC_BUDGETS:
        label = f"CHAL-02-burst-{b}"
        d = CHALLENGE_ROOT / label
        reg = _reg_status_from(d / "sophron_regression_delta_check.csv")

        burst_results_path = d / "sophron_probe_budget_results.csv"
        burst_pass = None
        if burst_results_path.exists():
            b_rows = list(csv.DictReader(burst_results_path.open("r", encoding="utf-8", newline="")))
            burst_pass = _passes_with_budget(_extract_target_rows(b_rows), b)
        else:
            t10 = _target10_pass_from(d / "sophron_probe_target10_check.csv")
            burst_pass = bool(t10)

        examined.append(f"{b}:{burst_pass}:{reg}")
        if burst_pass:
            elastic_pass = True
            lowest_passing_budget = str(b)
            break

    if static_pass:
        elastic_status = "PASS"
    elif elastic_pass:
        elastic_status = "PASS_ELASTIC"
    else:
        elastic_status = "FAIL"

    with OUT.open("w", encoding="utf-8", newline="") as f:
        fieldnames = [
            "static_10_pass",
            "elastic_status",
            "lowest_passing_burst_budget",
            "examined_budgets",
            "pass",
        ]
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerow(
            {
                "static_10_pass": static_pass,
                "elastic_status": elastic_status,
                "lowest_passing_burst_budget": lowest_passing_budget,
                "examined_budgets": "|".join(examined),
                "pass": elastic_status in {"PASS", "PASS_ELASTIC"},
            }
        )

    print(f"Wrote {OUT}")
    if elastic_status == "PASS":
        print("STATUS=pass")
    elif elastic_status == "PASS_ELASTIC":
        print("STATUS=pass_elastic")
    else:
        print("STATUS=fail")


if __name__ == "__main__":
    main()
