# Adapter: CER-Telemetry v0.1 receipts -> SOPHRON-CER alignment pack

This adapter reads JSON receipts produced by the **CER-Telemetry v0.1** instrumentation (the thin wrapper + instrumented `tmp_moltx_*` scripts) and runs the **SOPHRON-CER alignment pack** analysis over them.

## Why

- Lets you keep **v0.1 field instrumentation** stable.
- Enables **v2+ alignment analysis** as an opt-in layer.
- Avoids deep coupling / dependency bloat in the core CER-Telemetry repo.

## Usage

From the `SOPHRON-CER/` directory:

```bash
node examples/adapter_from_cer_v01_receipts.js \
  --receipts-dir "../outputs/receipts" \
  --out "../outputs/sophron_alignment_report.json"
```

Notes:
- If MoltX is heavily throttling and receipts are sparse/empty, the adapter will still run and emit a report.
- Current `probeResults` is empty; the report will mostly reflect SOPHRON message extraction (if any) + default scheduling.

## Input assumptions

- Receipts are JSON files and may contain either `run_id` or `runId` (adapter normalizes).
- No other receipt schema assumptions are made.

## Output

Writes a JSON report:

- `kind: sophron_alignment_report_v0`
- `report`: human-focused summary
- `analysis`: full alignment pack output (signals, invariants, probeSchedule, aggregateRisk, metadata)

## Next improvements

- Pass richer `context` (model version, environment hash, cohort drift).
- Load real `probeResults` when probes are implemented.
- Add a small receipt filter (e.g., only last N receipts, or only specific scripts).
