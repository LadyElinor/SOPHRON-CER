# safety_frames JSONL format (SOPHRON v0.3)

Location: `Reasoning/raw/safety_frames/*.jsonl`

Each line must conform to:
- `Reasoning/schemas/sophron_safety_frame_v0_3.schema.json`

Minimum required fields include:
- protocol_version, timestamp_utc, epoch_id
- align_status, probe_mode
- baseline_budget_pct, burst_budget_pct, safety_budget_total_pct, execution_budget_pct
- trigger_class, cooldown_remaining, escalation_level, heartbeat_age_ms
- audit_prev_anchor, audit_anchor, audit_footer

Runtime semantic constraints checked by tooling:
- `safety_budget_total_pct + execution_budget_pct ~= 100` (±0.5)
- `baseline_budget_pct + burst_budget_pct ~= safety_budget_total_pct` (±0.5)
- `execution_budget_pct >= execution_floor_pct`
