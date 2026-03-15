# SOPHRON Operator Run Sheet — Probe Budget

## Preflight (must pass)
1. Confirm safety frame schema check is green:
   - `python Reasoning/check_sophron_safety_frame_jsonl_schema.py`
2. Confirm raw output directory exists:
   - `Reasoning/raw/probe_budget_runs/`
3. Time sync host clock and ensure UTC timestamps in logs.

## Run matrix
| test_id | campaign_id | budget | workload | fault | reps | targets | run command template |
|---|---|---:|---|---|---:|---|---|
| PB-001 | PB-CAM-PB-001 | 5 | nominal | none | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=5.0 | `python your_runner.py --campaign-id PB-CAM-PB-001 --test-id PB-001 --budget 5 --workload nominal --fault none --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-001.jsonl` |
| PB-002 | PB-CAM-PB-002 | 5 | bursty | replay | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=5.0 | `python your_runner.py --campaign-id PB-CAM-PB-002 --test-id PB-002 --budget 5 --workload bursty --fault replay --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-002.jsonl` |
| PB-003 | PB-CAM-PB-003 | 5 | bursty | truncation | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=5.0 | `python your_runner.py --campaign-id PB-CAM-PB-003 --test-id PB-003 --budget 5 --workload bursty --fault truncation --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-003.jsonl` |
| PB-004 | PB-CAM-PB-004 | 5 | adversarial_jitter | sequence_reorder | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=5.0 | `python your_runner.py --campaign-id PB-CAM-PB-004 --test-id PB-004 --budget 5 --workload adversarial_jitter --fault sequence_reorder --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-004.jsonl` |
| PB-005 | PB-CAM-PB-005 | 5 | adversarial_jitter | semantic_invalid_checksum_valid | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=5.0 | `python your_runner.py --campaign-id PB-CAM-PB-005 --test-id PB-005 --budget 5 --workload adversarial_jitter --fault semantic_invalid_checksum_valid --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-005.jsonl` |
| PB-006 | PB-CAM-PB-006 | 10 | nominal | none | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=10.0 | `python your_runner.py --campaign-id PB-CAM-PB-006 --test-id PB-006 --budget 10 --workload nominal --fault none --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-006.jsonl` |
| PB-007 | PB-CAM-PB-007 | 10 | bursty | replay | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=10.0 | `python your_runner.py --campaign-id PB-CAM-PB-007 --test-id PB-007 --budget 10 --workload bursty --fault replay --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-007.jsonl` |
| PB-008 | PB-CAM-PB-008 | 10 | bursty | truncation | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=10.0 | `python your_runner.py --campaign-id PB-CAM-PB-008 --test-id PB-008 --budget 10 --workload bursty --fault truncation --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-008.jsonl` |
| PB-009 | PB-CAM-PB-009 | 10 | adversarial_jitter | sequence_reorder | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=10.0 | `python your_runner.py --campaign-id PB-CAM-PB-009 --test-id PB-009 --budget 10 --workload adversarial_jitter --fault sequence_reorder --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-009.jsonl` |
| PB-010 | PB-CAM-PB-010 | 10 | adversarial_jitter | semantic_invalid_checksum_valid | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=10.0 | `python your_runner.py --campaign-id PB-CAM-PB-010 --test-id PB-010 --budget 10 --workload adversarial_jitter --fault semantic_invalid_checksum_valid --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-010.jsonl` |
| PB-011 | PB-CAM-PB-011 | 15 | nominal | none | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=15.0 | `python your_runner.py --campaign-id PB-CAM-PB-011 --test-id PB-011 --budget 15 --workload nominal --fault none --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-011.jsonl` |
| PB-012 | PB-CAM-PB-012 | 15 | bursty | replay | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=15.0 | `python your_runner.py --campaign-id PB-CAM-PB-012 --test-id PB-012 --budget 15 --workload bursty --fault replay --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-012.jsonl` |
| PB-013 | PB-CAM-PB-013 | 15 | bursty | truncation | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=15.0 | `python your_runner.py --campaign-id PB-CAM-PB-013 --test-id PB-013 --budget 15 --workload bursty --fault truncation --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-013.jsonl` |
| PB-014 | PB-CAM-PB-014 | 15 | adversarial_jitter | sequence_reorder | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=15.0 | `python your_runner.py --campaign-id PB-CAM-PB-014 --test-id PB-014 --budget 15 --workload adversarial_jitter --fault sequence_reorder --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-014.jsonl` |
| PB-015 | PB-CAM-PB-015 | 15 | adversarial_jitter | semantic_invalid_checksum_valid | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=15.0 | `python your_runner.py --campaign-id PB-CAM-PB-015 --test-id PB-015 --budget 15 --workload adversarial_jitter --fault semantic_invalid_checksum_valid --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-015.jsonl` |
| PB-016 | PB-CAM-PB-016 | 20 | nominal | none | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=20.0 | `python your_runner.py --campaign-id PB-CAM-PB-016 --test-id PB-016 --budget 20 --workload nominal --fault none --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-016.jsonl` |
| PB-017 | PB-CAM-PB-017 | 20 | bursty | replay | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=20.0 | `python your_runner.py --campaign-id PB-CAM-PB-017 --test-id PB-017 --budget 20 --workload bursty --fault replay --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-017.jsonl` |
| PB-018 | PB-CAM-PB-018 | 20 | bursty | truncation | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=20.0 | `python your_runner.py --campaign-id PB-CAM-PB-018 --test-id PB-018 --budget 20 --workload bursty --fault truncation --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-018.jsonl` |
| PB-019 | PB-CAM-PB-019 | 20 | adversarial_jitter | sequence_reorder | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=20.0 | `python your_runner.py --campaign-id PB-CAM-PB-019 --test-id PB-019 --budget 20 --workload adversarial_jitter --fault sequence_reorder --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-019.jsonl` |
| PB-020 | PB-CAM-PB-020 | 20 | adversarial_jitter | semantic_invalid_checksum_valid | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=20.0 | `python your_runner.py --campaign-id PB-CAM-PB-020 --test-id PB-020 --budget 20 --workload adversarial_jitter --fault semantic_invalid_checksum_valid --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-020.jsonl` |
| PB-021 | PB-CAM-PB-021 | 25 | nominal | none | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=25.0 | `python your_runner.py --campaign-id PB-CAM-PB-021 --test-id PB-021 --budget 25 --workload nominal --fault none --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-021.jsonl` |
| PB-022 | PB-CAM-PB-022 | 25 | bursty | replay | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=25.0 | `python your_runner.py --campaign-id PB-CAM-PB-022 --test-id PB-022 --budget 25 --workload bursty --fault replay --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-022.jsonl` |
| PB-023 | PB-CAM-PB-023 | 25 | bursty | truncation | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=25.0 | `python your_runner.py --campaign-id PB-CAM-PB-023 --test-id PB-023 --budget 25 --workload bursty --fault truncation --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-023.jsonl` |
| PB-024 | PB-CAM-PB-024 | 25 | adversarial_jitter | sequence_reorder | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=25.0 | `python your_runner.py --campaign-id PB-CAM-PB-024 --test-id PB-024 --budget 25 --workload adversarial_jitter --fault sequence_reorder --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-024.jsonl` |
| PB-025 | PB-CAM-PB-025 | 25 | adversarial_jitter | semantic_invalid_checksum_valid | 30 | p95<=200 fnr<=0.0 fpr<=0.005 tpen<=25.0 | `python your_runner.py --campaign-id PB-CAM-PB-025 --test-id PB-025 --budget 25 --workload adversarial_jitter --fault semantic_invalid_checksum_valid --reps 30 --out Reasoning/raw/probe_budget_runs/pb-cam-pb-025.jsonl` |

## Post-run
1. Ingest: `python Reasoning/ingest_probe_budget_real_logs.py`
2. Check: `python Reasoning/check_sophron_probe_budget_results.py`
3. Summarize: `python Reasoning/summarize_sophron_probe_budget.py`
