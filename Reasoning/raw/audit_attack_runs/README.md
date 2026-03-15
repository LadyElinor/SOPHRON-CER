# audit_attack_runs JSONL format

One JSON object per line.

Required keys per record:
- `timestamp_utc` (ISO-8601)
- `source_type` (`hardware` | `sim`)
- `run_id`
- `attack_id` (`AUD-001` ...)
- `expected_result` (`reject`|`accept`)
- `observed_result` (`reject`|`accept`)
- `detector_evidence` (string or string array)
- `packet_loss_pct` (0..100)
- `jitter_ms` (>=0)
- `skew_ms` (>=0)

Optional:
- `log_evidence`, `noise_model`, `notes`

Example JSONL line:
```json
{"timestamp_utc":"2026-03-15T01:12:00Z","source_type":"sim","run_id":"SIM-AUD-0001","attack_id":"AUD-003","expected_result":"reject","observed_result":"reject","detector_evidence":["ChainCompletenessGuard","AnchorContinuityGuard"],"packet_loss_pct":1.0,"jitter_ms":6.0,"skew_ms":15.0,"log_evidence":"sim/logs/aud003_run1.json"}
```
