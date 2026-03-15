# SOPHRON-1 Core Specification v0.3 (Draft)

## 0. Status
- **Version:** v0.3-draft
- **Maturity:** prototype normative skeleton
- **Scope:** split-plane safety-active execution protocol
- **Non-goals:** microarchitecture-specific implementation details

---

## 1. Purpose and Design Principles
SOPHRON-1 defines a deterministic safety envelope that runs alongside execution operations.

### Principles
1. **Safety-active idle:** No-op must not imply unmonitored operation.
2. **Split-plane separation:** execution semantics and safety telemetry are independently verifiable.
3. **Deterministic degradation:** failures transition through explicit escalation states.
4. **Evidence anchoring:** every safety claim must be tied to auditable trace artifacts.

---

## 2. Architecture Model

### 2.1 Planes
- **Execution Plane (Data Plane):** ISA opcode execution.
- **Safety Plane (Control Plane):** heartbeat, probe budget, audit integrity, escalation control.

### 2.2 Interlock
If safety-plane heartbeat age exceeds threshold or critical integrity violation occurs, system MUST transition to safe-state per escalation policy.

---

## 3. Terminology
- **Epoch:** one protocol evaluation interval.
- **Heartbeat:** periodic safety-plane liveness frame.
- **Probe budget:** compute allocation for safety checks.
- **Audit anchor:** chain-linked provenance token.
- **Safe-state:** restricted terminal safety mode.

---

## 4. Normative Frame Schema (Safety Plane)

Each epoch MUST emit one safety frame with the following logical fields:

1. `protocol_version` (string)
2. `timestamp_utc` (ISO-8601)
3. `epoch_id` (monotonic integer)
4. `align_status` (enum: `GREEN|YELLOW|RED` triplet policy)
5. `probe_mode` (enum: `NULL|ACTIVE|BURST`)
6. `baseline_budget_pct` (number)
7. `burst_budget_pct` (number)
8. `safety_budget_total_pct` (number)
9. `execution_budget_pct` (number)
10. `trigger_class` (enum: `none|replay|truncation|fork|skew|jitter|semantic`)
11. `cooldown_remaining` (integer)
12. `escalation_level` (0..3)
13. `heartbeat_age_ms` (number)
14. `audit_prev_anchor` (string)
15. `audit_anchor` (string)
16. `audit_footer` (checksum/hash structure)

### 4.1 Mandatory constraints
- `safety_budget_total_pct + execution_budget_pct = 100 +/- epsilon`
- `execution_budget_pct >= execution_floor_pct`
- `epoch_id` MUST be strictly increasing
- `audit_prev_anchor` MUST match prior frame `audit_anchor` (canonical chain)

---

## 5. Execution Semantics

### 5.1 No-Op semantics
Execution-plane NOP means:
- no mission-operation side effects,
- safety-plane checks still mandatory.

### 5.2 Safety-active requirement
A cycle with missing safety frame is invalid and MUST be treated as integrity failure.

---

## 6. Budget Policy (Bounded Elastic)

### 6.1 Baseline
- Default baseline safety budget: implementation-defined (target 10% pending evidence closure).

### 6.2 Burst
- Burst allowed only under qualifying triggers.
- `burst_budget_pct <= burst_cap_pct`.
- Max consecutive burst epochs and cooldown enforced.

### 6.3 Guardrails
- Max burst grants / 100 epochs
- Max cumulative burst / 100 epochs
- Max tolerated P95 execution jitter increase

Violations MUST set escalation >= 2.

---

## 7. Escalation State Machine

### Levels
- **L0 Normal:** baseline only
- **L1 Elevated:** bounded burst active
- **L2 Restricted:** high-risk execution ops masked/limited
- **L3 Safe-state:** execution halted or failsafe profile enforced

### Transition requirements
- Transitions MUST be deterministic and evidence-emitting.
- Any L3 entry MUST include detector reason code and anchor pointer.

---

## 8. Integrity and Security Model

### 8.1 Threats in scope
- exact replay
- delayed replay
- truncation
- forked history
- frame reordering
- semantic-invalid with checksum-valid payload
- nonce collision
- footer stripping

### 8.2 Required detectors
- ReplayGuard
- WindowGuard
- SequenceGuard
- ChainCompletenessGuard
- AnchorContinuityGuard
- ForkDetector
- CanonicalityGuard
- SemanticInvariantGuard
- FooterIntegrityGuard
- NonceUniquenessGuard

### 8.3 Acceptance
All in-scope attacks marked reject in matrix MUST be rejected with detector evidence.

---

## 9. Evidence and Compliance Artifacts

Required artifacts:
- competing hypotheses matrix + check
- uncertainty ledger + check
- audit attack matrix/results + check
- probe budget matrix/results/summary + check
- skew matrix/results/summary + check
- UNC status card

### 9.1 Source-of-truth rule
`hardware|sim` raw logs in `Reasoning/raw/*` are normative inputs for sign-off.
Synthetic harness output is developmental evidence only.

---

## 10. Conformance Test Levels

- **L0 Schema conformance:** field completeness, type/range checks
- **L1 Protocol conformance:** chain/order/heartbeat/budget invariants
- **L2 Adversarial conformance:** attack matrix rejection behavior
- **L3 Performance conformance:** latency/FN/FP/jitter thresholds

System is compliant only if all required levels pass.

---

## 11. Versioning and Compatibility

- Major: breaking frame/state semantics
- Minor: backward-compatible fields/threshold updates
- Patch: editorial/check tooling fixes

Each frame MUST include `protocol_version`.

---

## 12. Open Items (to close before v0.3-final)
1. Final baseline budget target from real evidence (UNC-001).
2. Cross-plane skew tolerance envelope and fail-safe threshold constants (UNC-002).
3. Hardware/sim-backed audit robustness closure and replay window constants (UNC-003).
4. Final burst guardrail constants and deterministic jitter budget.

---

## 13. Immediate Next Actions
1. Bind this draft to JSON schema(s) for safety frame records.
2. Add explicit reason-code registry for detector/elevation events.
3. Run real-evidence pipeline with populated raw logs and update UNC status card.
4. Promote UNC items from `uncertain` to `known` only with linked evidence artifacts.
