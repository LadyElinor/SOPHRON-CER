# SOPHRON-1 Elastic Budget Policy (Bounded) v0.1

## Goal
Increase safety-plane responsiveness during anomaly windows while preserving deterministic execution guarantees for the split-plane architecture.

## Policy
1. **Baseline Reservation**
   - Safety plane receives a fixed baseline budget (default: `10%`) every control epoch.

2. **Bounded Burst**
   - Additional budget may be granted only on qualifying triggers (alignment jitter, replay detector pre-trigger, chain continuity warning).
   - Burst increment cap: `+5%` above baseline.
   - Absolute safety-plane cap per epoch: `15%`.

3. **Burst Duration Cap**
   - Max consecutive burst epochs: `3`.
   - After cap is reached, system enters cooldown.

4. **Cooldown + Hysteresis**
   - Cooldown epochs: `5` (no new burst grants).
   - Trigger must remain clear for `2` consecutive epochs before returning to nominal state.

5. **Execution Plane Floor**
   - Execution plane minimum compute floor: `85%`.
   - Violation forces immediate fallback to fixed-baseline mode + warning flag.

6. **Safety Escalation Ladder**
   - Level 0: Baseline only.
   - Level 1: Bounded burst enabled.
   - Level 2: Restricted execution operations (high-risk ops masked).
   - Level 3: Safe-state transition (stale heartbeat / critical integrity breach).

## Determinism Guardrails
- Max burst grants per 100 epochs: `12`.
- Max cumulative burst budget per 100 epochs: `+40%` equivalent.
- Max observed execution latency jitter increase at P95: `<= 8%` vs fixed-baseline mode.

## Telemetry Requirements
Per epoch record:
- `epoch_id`
- `baseline_budget_pct`
- `burst_granted`
- `burst_budget_pct`
- `safety_budget_total_pct`
- `execution_budget_pct`
- `trigger_class`
- `cooldown_remaining`
- `escalation_level`
- `heartbeat_age_ms`

## Compliance Rule
Policy is compliant only if all guardrail thresholds remain satisfied and no execution-floor violation occurs.
