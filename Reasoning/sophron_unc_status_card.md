# SOPHRON UNC Status Card

| Uncertainty | Scope | Status | Evidence |
|---|---|---|---|
| SOPH-RAW-PROBE | Probe JSONL schema compliance | PASS | `Reasoning/sophron_probe_jsonl_schema_check.csv` |
| SOPH-RAW-SKEW | Skew JSONL schema compliance | PASS | `Reasoning/sophron_skew_jsonl_schema_check.csv` |
| SOPH-RAW-AUDIT | Audit JSONL schema compliance | PASS | `Reasoning/sophron_audit_jsonl_schema_check.csv` |
| SOPH-UNC-001 | Probe budget selection | PASS | `Reasoning/sophron_probe_budget_summary.md` |
| SOPH-UNC-001-BRIDGE | Probe budget 20/25 bridge sufficiency | PASS | `Reasoning/sophron_probe_budget_bridge_check.csv` |
| SOPH-UNC-001-TARGET10 | Chunked 10% target sufficiency | PASS | `Reasoning/sophron_probe_target10_check.csv` |
| SOPH-REG-DELTA | Baseline regression delta guard | PASS | `Reasoning/sophron_regression_delta_check.csv` |
| SOPH-ELASTIC-STATE | Dynamic safety posture (NOMINAL/STABILIZING/FAIL-SAFE) | NOMINAL | `Reasoning/sophron_probe_budget_bridge_check.csv` |
| SOPH-ADV-POLICY | Adversarial policy resilience (deny/contain checks) | PASS | `Reasoning/sophron_adversarial_resilience_check.csv` |
| SOPH-UNC-002 | Cross-plane skew tolerance | PASS | `Reasoning/sophron_cross_plane_skew_summary.md` |
| SOPH-UNC-003 | Audit replay/truncation robustness | PASS | `Reasoning/sophron_audit_attack_results.csv` |
| SOPH-CORE-FRAME | Safety frame schema/runtime semantics | PASS | `Reasoning/sophron_safety_frame_schema_check.csv` |
| SOPH-SAFETY-CASE | Formal safety-case summary/specification | INFO | `Reasoning/SOPHRON-1-safety-case-v1.md` |

## Overall
- overall: **PASS**

## Challenge Matrix View

| Scenario | Core Elastic Pass | Robust TARGET10 | REG-DELTA | chunked@10 mean p95 (ms) |
|---|---|---|---|---:|
| BASELINE | MISSING | PASS | PASS | 169.721 |
| CHAL-01 | MISSING | PASS | REGRESSION_WARNING | 175.177 |
| CHAL-02-noise-1.25 | MISSING | FAIL | FAIL | 169.536 |
| CHAL-02-noise-1.25-RAW | MISSING | FAIL | FAIL | 169.536 |
| CHAL-02-noise-1.25-EMA035 | MISSING | FAIL | FAIL | 169.487 |
| CHAL-02-noise-1.25-EMA015 | MISSING | FAIL | FAIL | 169.135 |
| CHAL-02-noise-1.50 | MISSING | FAIL | FAIL | 169.35 |
| CHAL-02-noise-2.00 | MISSING | FAIL | FAIL | 168.98 |
| CHAL-02-noise-2.50 | MISSING | FAIL | FAIL | 168.609 |
| CHAL-02-burst-15 | PASS | FAIL | FAIL | 144.602 |
| CHAL-02-burst-18 | PASS | FAIL | FAIL | 159.562 |
| CHAL-02-burst-20 | PASS | FAIL | FAIL | 129.641 |

## Notes
- Status is computed from check CSV artifacts.
- For final sign-off, ensure raw inputs are hardware/sim-backed logs, not synthetic harness outputs.
