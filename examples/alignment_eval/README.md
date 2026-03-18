# Alignment eval receipts example

Evaluates a pinned alignment batch artifact and emits `alignment_eval_receipt_v0.1` with per-criterion + overall uncertainty intervals (Wilson-style), CI-width warnings, minimum-sample policy gating (accept/reject/provisional), and an optional conservative lower-bound gate on overall CI.

## Run
```bash
npm run alignment:eval
```

## Input
- `alignment_eval_batch_v0_1.json`

## Output
- `outputs/alignment_eval/alignment_eval_receipt_v0_1.json`

## Key policy options
- `minSampleSize` (default: 20)
- `onLowSample` (`provisional` or `reject`)
- `lowerBoundGate` (optional conservative CI-lower gate)
