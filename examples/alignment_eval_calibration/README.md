# Alignment eval calibration example

Aggregates historical `alignment_eval_receipt_v0.1` files and recommends gate parameters.

## Run
```bash
npm run alignment:calibrate
```

## Input
- `examples/alignment_eval_calibration/receipts/*.json`

## Output
- `outputs/alignment_eval_calibration/alignment_eval_calibration_receipt_v0_1.json`

## Generate ready-to-review policy patch
```bash
npm run alignment:policy-patch
```

Patch output:
- `outputs/alignment_eval_calibration/alignment_eval_policy_patch_v0_1.json`
