# SOPHRON-1 Alternative Architectures (v0.1)

## Objective
Guarantee continuous safety monitoring during idle/no-op cycles while preserving deterministic execution, auditability, and low overhead.

## Observation
A safety-active idle state is required: "No-op" must not imply "no monitoring."

## Competing Hypotheses (Architecture Options)

### H1 — In-band Huffman ISA Safety Semantics
Safety metadata is conceptually embedded with compressed instruction semantics.

- Strengths:
  - High conceptual elegance (single semantic plane)
  - Potential opcode bandwidth efficiency
- Weaknesses:
  - Variable-length decode fragility
  - Harder fault containment and formal verification
- Predicted signature:
  - Strong compression metrics but elevated boundary-desync fault sensitivity
- Disconfirming test:
  - Inject bit-level corruption and measure safety-state misinterpretation rate

### H2 — Split-Plane (Execution ISA + Safety Envelope) **[Recommended]**
Execution ISA remains decode-safe and deterministic; SOPHRON envelope carries heartbeat/alignment/audit telemetry.

- Strengths:
  - Best verifiability and deterministic timing behavior
  - Clear fault-domain separation
  - Alignment semantics preserved without decoder fragility
- Weaknesses:
  - Additional coordination logic between planes
- Predicted signature:
  - Lower desync risk and cleaner audit traces under fault injection
- Disconfirming test:
  - Force cross-plane clock skew and verify watchdog/fail-safe behavior

### H3 — Microcode-Enforced Safety NOP
ISA `NOP` triggers mandatory microcode path that performs probe/audit updates.

- Strengths:
  - Strong local enforcement
  - Minimal ISA-level syntax complexity
- Weaknesses:
  - Concentrated trust in microcode correctness
  - Reduced external transparency unless mirrored in logs
- Predicted signature:
  - High runtime determinism; verification bottleneck at microcode layer
- Disconfirming test:
  - Differential microcode fuzzing for silent safety bypasses

### H4 — Hypervisor-Mediated Safety Scheduler
Guest ISA remains unchanged; monitor enforces probe budget and attestation cadence.

- Strengths:
  - Retrofit path for existing stacks
  - Isolation from guest compiler/runtime drift
- Weaknesses:
  - Added overhead and scheduling jitter
  - Shifts trust to monitor integrity
- Predicted signature:
  - Good containment but measurable latency inflation under contention
- Disconfirming test:
  - Adversarial workload saturation + monitor preemption tests

## Comparative Scoring (1–5)
| Option | Safety Assurance | Determinism | Runtime Efficiency | Verifiability | Total |
|---|---:|---:|---:|---:|---:|
| H1 In-band Huffman ISA | 3 | 2 | 4 | 2 | 11 |
| H2 Split-Plane | 5 | 5 | 4 | 5 | **19** |
| H3 Microcode-Enforced NOP | 4 | 5 | 5 | 3 | 17 |
| H4 Hypervisor-Mediated | 4 | 4 | 3 | 4 | 15 |

## Decision
Adopt **H2 Split-Plane** as baseline architecture for SOPHRON-1 implementation.

## Proposed Minimal Protocol Mapping
- Data plane: fixed/decoder-safe ISA (`NOP=0` allowed as execution symbol only)
- Safety plane frame (deterministic envelope):
  - `ALIGN_STATUS`
  - `PROBE`
  - `BUDGET` (baseline compute allocation)
  - `AUDIT` (provenance/checksum/anchor)
- Interlock:
  - If safety plane heartbeat stale beyond threshold -> force safe-state transition.

## Next Experiments
1. Fault injection campaign (bit flips + framing corruption)
2. Cross-plane skew and dropout tests
3. Audit-chain replay/truncation resistance tests
4. Probe budget sweep (5/10/15%) vs detection latency
