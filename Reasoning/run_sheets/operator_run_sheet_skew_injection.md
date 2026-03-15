# SOPHRON Operator Run Sheet — Cross-Plane Skew Injection

## Preflight (must pass)
1. Confirm safety frame schema check is green:
   - `python Reasoning/check_sophron_safety_frame_jsonl_schema.py`
2. Confirm raw output directory exists:
   - `Reasoning/raw/skew_runs/`
3. Ensure watchdog + stale-heartbeat telemetry enabled.

## Run matrix
| campaign_id | phase | workload | pretrigger | skew_ms | jitter_ms | loss% | reps | expectation | command template |
|---|---|---|---|---:|---:|---:|---:|---|---|
| SKC-A-001 | A | bursty | none | 0 | 2 | 0.0 | 30 | coarse-scan | `python your_skew_runner.py --campaign-id SKC-A-001 --phase A --workload bursty --pretrigger none --skew-ms 0 --jitter-ms 2 --loss-pct 0.0 --reps 30 --out Reasoning/raw/skew_runs/skc-a-001.jsonl` |
| SKC-A-002 | A | bursty | none | 5 | 2 | 0.0 | 30 | coarse-scan | `python your_skew_runner.py --campaign-id SKC-A-002 --phase A --workload bursty --pretrigger none --skew-ms 5 --jitter-ms 2 --loss-pct 0.0 --reps 30 --out Reasoning/raw/skew_runs/skc-a-002.jsonl` |
| SKC-A-003 | A | bursty | none | 10 | 2 | 0.0 | 30 | coarse-scan | `python your_skew_runner.py --campaign-id SKC-A-003 --phase A --workload bursty --pretrigger none --skew-ms 10 --jitter-ms 2 --loss-pct 0.0 --reps 30 --out Reasoning/raw/skew_runs/skc-a-003.jsonl` |
| SKC-A-004 | A | bursty | none | 15 | 2 | 0.0 | 30 | coarse-scan | `python your_skew_runner.py --campaign-id SKC-A-004 --phase A --workload bursty --pretrigger none --skew-ms 15 --jitter-ms 2 --loss-pct 0.0 --reps 30 --out Reasoning/raw/skew_runs/skc-a-004.jsonl` |
| SKC-A-005 | A | bursty | none | 20 | 2 | 0.0 | 30 | coarse-scan | `python your_skew_runner.py --campaign-id SKC-A-005 --phase A --workload bursty --pretrigger none --skew-ms 20 --jitter-ms 2 --loss-pct 0.0 --reps 30 --out Reasoning/raw/skew_runs/skc-a-005.jsonl` |
| SKC-A-006 | A | bursty | none | 25 | 2 | 0.0 | 30 | coarse-scan | `python your_skew_runner.py --campaign-id SKC-A-006 --phase A --workload bursty --pretrigger none --skew-ms 25 --jitter-ms 2 --loss-pct 0.0 --reps 30 --out Reasoning/raw/skew_runs/skc-a-006.jsonl` |
| SKC-A-007 | A | bursty | none | 30 | 2 | 0.0 | 30 | coarse-scan | `python your_skew_runner.py --campaign-id SKC-A-007 --phase A --workload bursty --pretrigger none --skew-ms 30 --jitter-ms 2 --loss-pct 0.0 --reps 30 --out Reasoning/raw/skew_runs/skc-a-007.jsonl` |
| SKC-A-008 | A | bursty | none | 35 | 2 | 0.0 | 30 | coarse-scan | `python your_skew_runner.py --campaign-id SKC-A-008 --phase A --workload bursty --pretrigger none --skew-ms 35 --jitter-ms 2 --loss-pct 0.0 --reps 30 --out Reasoning/raw/skew_runs/skc-a-008.jsonl` |
| SKC-A-009 | A | bursty | none | 40 | 2 | 0.0 | 30 | coarse-scan | `python your_skew_runner.py --campaign-id SKC-A-009 --phase A --workload bursty --pretrigger none --skew-ms 40 --jitter-ms 2 --loss-pct 0.0 --reps 30 --out Reasoning/raw/skew_runs/skc-a-009.jsonl` |
| SKC-A-010 | A | bursty | replay_pretrigger | 10 | 5 | 0.5 | 30 | coarse-scan | `python your_skew_runner.py --campaign-id SKC-A-010 --phase A --workload bursty --pretrigger replay_pretrigger --skew-ms 10 --jitter-ms 5 --loss-pct 0.5 --reps 30 --out Reasoning/raw/skew_runs/skc-a-010.jsonl` |
| SKC-A-011 | A | bursty | replay_pretrigger | 20 | 5 | 0.5 | 30 | coarse-scan | `python your_skew_runner.py --campaign-id SKC-A-011 --phase A --workload bursty --pretrigger replay_pretrigger --skew-ms 20 --jitter-ms 5 --loss-pct 0.5 --reps 30 --out Reasoning/raw/skew_runs/skc-a-011.jsonl` |
| SKC-A-012 | A | bursty | replay_pretrigger | 30 | 5 | 0.5 | 30 | coarse-scan | `python your_skew_runner.py --campaign-id SKC-A-012 --phase A --workload bursty --pretrigger replay_pretrigger --skew-ms 30 --jitter-ms 5 --loss-pct 0.5 --reps 30 --out Reasoning/raw/skew_runs/skc-a-012.jsonl` |
| SKC-A-013 | A | adversarial_jitter | truncation_pretrigger | 10 | 8 | 1.0 | 30 | coarse-scan | `python your_skew_runner.py --campaign-id SKC-A-013 --phase A --workload adversarial_jitter --pretrigger truncation_pretrigger --skew-ms 10 --jitter-ms 8 --loss-pct 1.0 --reps 30 --out Reasoning/raw/skew_runs/skc-a-013.jsonl` |
| SKC-A-014 | A | adversarial_jitter | truncation_pretrigger | 20 | 8 | 1.0 | 30 | coarse-scan | `python your_skew_runner.py --campaign-id SKC-A-014 --phase A --workload adversarial_jitter --pretrigger truncation_pretrigger --skew-ms 20 --jitter-ms 8 --loss-pct 1.0 --reps 30 --out Reasoning/raw/skew_runs/skc-a-014.jsonl` |
| SKC-A-015 | A | adversarial_jitter | truncation_pretrigger | 30 | 8 | 1.0 | 30 | coarse-scan | `python your_skew_runner.py --campaign-id SKC-A-015 --phase A --workload adversarial_jitter --pretrigger truncation_pretrigger --skew-ms 30 --jitter-ms 8 --loss-pct 1.0 --reps 30 --out Reasoning/raw/skew_runs/skc-a-015.jsonl` |
| SKC-B-001 | B | adversarial_jitter | replay_pretrigger | 23 | 8 | 1.0 | 50 | boundary-search | `python your_skew_runner.py --campaign-id SKC-B-001 --phase B --workload adversarial_jitter --pretrigger replay_pretrigger --skew-ms 23 --jitter-ms 8 --loss-pct 1.0 --reps 50 --out Reasoning/raw/skew_runs/skc-b-001.jsonl` |
| SKC-B-002 | B | adversarial_jitter | replay_pretrigger | 24 | 8 | 1.0 | 50 | boundary-search | `python your_skew_runner.py --campaign-id SKC-B-002 --phase B --workload adversarial_jitter --pretrigger replay_pretrigger --skew-ms 24 --jitter-ms 8 --loss-pct 1.0 --reps 50 --out Reasoning/raw/skew_runs/skc-b-002.jsonl` |
| SKC-B-003 | B | adversarial_jitter | replay_pretrigger | 25 | 8 | 1.0 | 50 | boundary-search | `python your_skew_runner.py --campaign-id SKC-B-003 --phase B --workload adversarial_jitter --pretrigger replay_pretrigger --skew-ms 25 --jitter-ms 8 --loss-pct 1.0 --reps 50 --out Reasoning/raw/skew_runs/skc-b-003.jsonl` |
| SKC-B-004 | B | adversarial_jitter | replay_pretrigger | 26 | 8 | 1.0 | 50 | boundary-search | `python your_skew_runner.py --campaign-id SKC-B-004 --phase B --workload adversarial_jitter --pretrigger replay_pretrigger --skew-ms 26 --jitter-ms 8 --loss-pct 1.0 --reps 50 --out Reasoning/raw/skew_runs/skc-b-004.jsonl` |
| SKC-B-005 | B | adversarial_jitter | replay_pretrigger | 27 | 8 | 1.0 | 50 | boundary-search | `python your_skew_runner.py --campaign-id SKC-B-005 --phase B --workload adversarial_jitter --pretrigger replay_pretrigger --skew-ms 27 --jitter-ms 8 --loss-pct 1.0 --reps 50 --out Reasoning/raw/skew_runs/skc-b-005.jsonl` |
| SKC-B-006 | B | adversarial_jitter | replay_pretrigger | 28 | 8 | 1.0 | 50 | boundary-search | `python your_skew_runner.py --campaign-id SKC-B-006 --phase B --workload adversarial_jitter --pretrigger replay_pretrigger --skew-ms 28 --jitter-ms 8 --loss-pct 1.0 --reps 50 --out Reasoning/raw/skew_runs/skc-b-006.jsonl` |
| SKC-B-007 | B | adversarial_jitter | replay_pretrigger | 29 | 8 | 1.0 | 50 | boundary-search | `python your_skew_runner.py --campaign-id SKC-B-007 --phase B --workload adversarial_jitter --pretrigger replay_pretrigger --skew-ms 29 --jitter-ms 8 --loss-pct 1.0 --reps 50 --out Reasoning/raw/skew_runs/skc-b-007.jsonl` |
| SKC-B-008 | B | adversarial_jitter | replay_pretrigger | 30 | 8 | 1.0 | 50 | boundary-search | `python your_skew_runner.py --campaign-id SKC-B-008 --phase B --workload adversarial_jitter --pretrigger replay_pretrigger --skew-ms 30 --jitter-ms 8 --loss-pct 1.0 --reps 50 --out Reasoning/raw/skew_runs/skc-b-008.jsonl` |
| SKC-B-009 | B | adversarial_jitter | replay_pretrigger | 31 | 8 | 1.0 | 50 | boundary-search | `python your_skew_runner.py --campaign-id SKC-B-009 --phase B --workload adversarial_jitter --pretrigger replay_pretrigger --skew-ms 31 --jitter-ms 8 --loss-pct 1.0 --reps 50 --out Reasoning/raw/skew_runs/skc-b-009.jsonl` |
| SKC-B-010 | B | adversarial_jitter | replay_pretrigger | 32 | 8 | 1.0 | 50 | boundary-search | `python your_skew_runner.py --campaign-id SKC-B-010 --phase B --workload adversarial_jitter --pretrigger replay_pretrigger --skew-ms 32 --jitter-ms 8 --loss-pct 1.0 --reps 50 --out Reasoning/raw/skew_runs/skc-b-010.jsonl` |
| SKC-B-011 | B | adversarial_jitter | replay_pretrigger | 33 | 8 | 1.0 | 50 | boundary-search | `python your_skew_runner.py --campaign-id SKC-B-011 --phase B --workload adversarial_jitter --pretrigger replay_pretrigger --skew-ms 33 --jitter-ms 8 --loss-pct 1.0 --reps 50 --out Reasoning/raw/skew_runs/skc-b-011.jsonl` |

## Safe envelope reminders
- Keep execution floor >= 85%
- Watch for jitter-cap violations and escalation-level transitions
- Flag runs where observed behavior mismatches expected_result immediately

## Post-run
1. Ingest: `python Reasoning/ingest_sophron_skew_real_logs.py`
2. Check: `python Reasoning/check_sophron_cross_plane_skew.py`
3. Summarize: `python Reasoning/summarize_sophron_cross_plane_skew.py`
