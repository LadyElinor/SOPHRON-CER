# Alignment Eval Roadmap (next steps)

## Implemented
- Batch eval receipt generation (`alignment_eval_batch_v0.1` -> `alignment_eval_receipt_v0.1`).
- Uncertainty layer (overall + criterion intervals).
- CI-width warnings.
- Minimum sample policy gating (`accept` / `provisional_low_sample` / `reject_low_sample`).
- Optional lower-bound confidence gate.
- Historical calibration module from receipt sets.

## Next practical steps
1. Add domain packs for rubric presets (assistant honesty/corrigibility/helpfulness variants).
2. Add bootstrap confidence diagnostics for criterion means.
3. Add drift tracking over time (rolling windows over receipts).
4. Add strict schema validation utility against `schemas/alignment_eval_*` artifacts.
5. Integrate calibration recommendations into CI check thresholds with explicit approval step.

## Newly added in this cycle
- Policy patch generator from calibration receipts:
  - `checkers/alignment_policy_patch.js`
  - emits `alignment_eval_policy_patch_v0.1` for manual review before config apply.
