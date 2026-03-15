# SOPHRON-1 Audit-Chain Replay/Truncation Test Plan (v0.1)

## Goal
Validate replay resistance, chain integrity, and semantic-audit coupling for the split-plane safety envelope.

## Scope
- Replay protections (exact + delayed)
- Chain continuity and completeness
- Canonical branch enforcement
- Sequence ordering
- Semantic invariants under checksum-valid tampering

## Source Matrix
- `Reasoning/sophron_audit_attack_matrix.csv`

## Required Artifacts per Test
- input trace id
- mutated trace id
- detector(s) fired
- verdict (`reject`/`accept`)
- evidence pointer (log hash / report line)

## Acceptance Criteria
- All attacks in matrix with `expected_result=reject` must be rejected.
- No false accepts for high-severity attacks.
- Detector names in evidence must match expected detector class or stricter equivalent.

## Priority Order
1. AUD-001 exact replay
2. AUD-003 truncation
3. AUD-004 fork history
4. AUD-006 checksum-valid context-invalid
5. AUD-002 delayed replay
6. Remaining medium/high cases

## Minimal Report Format
| attack_id | expected | observed | pass | detector_evidence |
|---|---|---|---|---|

Outputs:
- `Reasoning/sophron_audit_attack_results.csv`
- `Reasoning/sophron_audit_attack_results.md`
