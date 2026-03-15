# SOPHRON-1 Hardware/Sim Evidence Campaign (v0.1)

## Objective
Replace synthetic harness evidence with hardware/simulation-backed evidence for:
1) probe budget selection (incl. 20/25 expansion + backward optimization),
2) cross-plane skew tolerance,
3) audit replay/truncation robustness under realistic timing/noise.

## Required raw evidence inputs
- `Reasoning/raw/probe_budget_runs/*.jsonl`
- `Reasoning/raw/skew_runs/*.jsonl`
- `Reasoning/raw/audit_attack_runs/*.jsonl`

Each record should include:
- timestamp_utc
- test_id or attack_id
- source_type (`hardware`|`sim`)
- run_id
- metrics (latency/fnr/fpr/throughput/jitter/etc.)
- detector events and verdict

## Execution order
1. Run probe budget matrix at 5/10/15/20/25.
2. Run skew matrix and determine tolerance envelope.
3. Run audit attack matrix with injected timing noise and packet loss.
4. Ingest raw logs into result CSVs using ingestion scripts.
5. Re-run checkers and regenerate summaries.

## Exit criteria
- Probe summary yields a concrete recommended budget.
- Skew tolerance report has validated max skew/jitter thresholds.
- Audit attack results check passes with source_type != synthetic.
- Uncertainty ledger entries SOPH-UNC-001/002/003 downgraded from uncertain to known with evidence links.
