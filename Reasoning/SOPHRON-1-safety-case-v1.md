# SOPHRON-1 Safety Case Summary (v1)

## Scope
Formal safety-case summary for the SOPHRON-1 split-plane kernel using current simulation-backed evidence artifacts in `Reasoning/`.

## 1) Operating Envelope (evidence-backed)

### NOMINAL
- Posture: `NOMINAL`
- Typical condition: baseline / low-noise operation.
- Expected signals:
  - `SOPH-UNC-001-TARGET10 = PASS`
  - `SOPH-REG-DELTA = PASS`
- Reference evidence:
  - `Reasoning/challenges/BASELINE/*`

### STABILIZING
- Posture: `STABILIZING`
- Condition: drift/noise where robust 10% guardrail warns/fails but elastic recovery remains possible.
- Expected signals:
  - `SOPH-REG-DELTA = REGRESSION_WARNING` and/or
  - bridge classifier emits `PASS_ELASTIC`.
- Reference evidence:
  - `Reasoning/challenges/CHAL-01/*` (warning behavior)
  - `Reasoning/challenges/CHAL-02-burst-15/*` (core elastic recovery lane)

### FAIL-SAFE
- Posture: `FAIL-SAFE`
- Condition: unrecoverable environment where core elastic pass fails even at max tested burst tier.
- Trigger criterion (current campaign):
  - CHAL-03 at burst@20% fails core elastic checks.
- Reference evidence:
  - `Reasoning/challenges/CHAL-03-stress-burst20-noise-2.5/*`
  - `Reasoning/challenges/CHAL-03-stress-burst20-noise-3/*`
  - `Reasoning/challenges/CHAL-03-stress-burst20-noise-3.5/*`
  - `Reasoning/challenges/CHAL-03-stress-burst20-noise-4/*`

## 2) Thresholds and Transition Criteria

## A. Robust 10% target gate
From `Reasoning/check_sophron_probe_target10.py`:
- complete replicate coverage for `PB-C-006..010`
- core threshold pass
- minimum margin constraints
- stability caps (CV/stddev)
- tail envelope constraints

Output artifact:
- `Reasoning/sophron_probe_target10_check.csv`

## B. Regression guardrail
From `Reasoning/sophron_regression_delta_checker.py`:
- `REGRESSION_WARNING` if `p95 drift > 5%` OR margin shrink `> 10%`
- `FAIL` on seed mismatch or TARGET10 not passing

Output artifact:
- `Reasoning/sophron_regression_delta_check.csv`

## C. Elastic bridge classifier
From `Reasoning/check_sophron_probe_budget_bridge.py`:
- `PASS`: static robust lane healthy
- `PASS_ELASTIC`: static lane degraded, lowest burst tier recovers core pass
- `FAIL`: no tested burst tier recovers core pass

Output artifact:
- `Reasoning/sophron_probe_budget_bridge_check.csv`

## 3) Observed campaign boundaries (current)
- Baseline: PASS (nominal).
- CHAL-01 slow-walk drift: robust lane remains pass while regression warning triggers.
- CHAL-02 noise 1.25x: robust lane fails at static 10%.
- CHAL-02 burst sweeps (15/18/20): core elastic recovery appears at 15% tier (bridge classifier).
- CHAL-03 stress burst @20% with noise {2.5x, 3.0x, 3.5x, 4.0x}: core elastic fail across all tested tiers.

## 4) Safety State Machine (operational)
1. Start in `NOMINAL` (10% target lane).
2. If regression warning or robust degradation appears, enter `STABILIZING` and evaluate elastic burst tiers.
3. If elastic bridge yields `PASS_ELASTIC`, continue in `STABILIZING` with elevated compute.
4. If elastic bridge yields `FAIL`, transition immediately to `FAIL-SAFE` (protected halt/recovery procedure).

## 5) Assumptions and Known Limits
- Evidence is simulation-backed; hardware-in-the-loop evidence remains required for final deployment sign-off.
- Noise multipliers are campaign controls, not direct physical-unit calibration.
- Core elastic pass and robust pass are intentionally distinct; `PASS_ELASTIC` is not equivalent to robust TARGET10 pass.
- Current boundaries are valid for present seed/profile/config and should be revalidated after major logic changes.

## 6) Canonical Evidence Index
- Status card: `Reasoning/sophron_unc_status_card.md`
- Robust target check: `Reasoning/sophron_probe_target10_check.csv`
- Regression guard: `Reasoning/sophron_regression_delta_check.csv`
- Elastic bridge: `Reasoning/sophron_probe_budget_bridge_check.csv`
- Challenge captures: `Reasoning/challenges/`
