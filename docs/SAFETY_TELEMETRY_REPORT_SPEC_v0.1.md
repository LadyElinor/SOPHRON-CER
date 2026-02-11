# Safety Telemetry Report (STR) — Spec v0.1

**Status:** v0.1 (canonical, machine-readable contract)

This spec defines the **Safety Telemetry Report** artifact emitted at the end of every SOPHRON-CER run.
It is designed to be:
- **Decision-grade**: primary signals are capped and selection is reproducible.
- **Auditable**: strong manifests (git/config/deps/data identity) are mandatory.
- **Humble**: statistical quality flags are first-class.
- **Separable**: measurement (“findings”) is distinct from interpretation (“assessment”).

## Files
A run SHOULD emit at least:
- `safety_report.json` (required)
- `safety_report.md` (optional, human summary)

## JSON Top-Level Shape

```json
{
  "report_id": "uuid",
  "spec_version": "0.1",
  "generated_at": "ISO8601",

  "manifest": {
    "run_id": "string",
    "git_sha": "string",
    "package_version": "string",
    "config_hash": "sha256:<hex>",
    "dependency_lock_hash": "sha256:<hex>",
    "data_hash": "sha256:<hex>"
  },

  "data_summary": {
    "sample_size": 0,
    "effective_n": null,
    "time_window": { "start": null, "end": null },
    "sources": ["string"]
  },

  "invariants": {
    "all_passed": true,
    "violations": []
  },

  "primary_signal_selection": {
    "max_primary": 10,
    "method": "risk_weighted_topk",
    "deterministic": true,
    "inputs": ["prevalence", "ci_width"],
    "seed": null,
    "notes": "Deterministic given the same inputs"
  },

  "findings": {
    "primary_signals": [],
    "secondary_signals": []
  },

  "privacy": {
    "pii_redactions": 0,
    "k_anonymity_threshold": 5
  },

  "assessment": {
    "overall": {
      "category": "low|moderate|high|unknown",
      "score": null,
      "components": []
    },
    "guidance": "string",
    "alerts_triggered": []
  }
}
```

## Anti-failure Mechanisms (MANDATORY in v0.1)

### 1) Primary-signal cap
- `primary_signal_selection.max_primary` MUST be present.
- The emitter MUST cap `findings.primary_signals.length <= max_primary`.
- The emitter MUST disclose the method and inputs used.

### 2) Statistical humility flags
Each signal MUST include a `stats_quality` object, with:
- `flags`: array of strings, e.g.:
  - `low_power`, `power_unknown`
  - `multiple_comparisons_adjusted`, `multiplicity_unknown`
  - `unstable_n`, `wide_ci`

### 3) Manifest hardening
The report MUST include the manifest fields:
- `git_sha`
- `config_hash`
- `dependency_lock_hash`
- `data_hash`

If any required manifest field is missing, the report emitter MUST FAIL (and therefore the run fails unless explicitly configured otherwise).

## Findings vs Assessment

### Findings
**Findings are measurement outputs.** They should be computable and comparable.

Each signal object SHOULD resemble:

```json
{
  "signal_id": "string",
  "description": "string",
  "estimate": 0.0,
  "ci": { "lower": 0.0, "upper": 0.0, "method": "wilson|bootstrap|none" },
  "effect_size": { "cohen_h": null, "interpretation": null },
  "tests": {
    "p_value": null,
    "p_adjusted": null,
    "adjustment": "none|holm|bonferroni",
    "m": null
  },
  "stats_quality": {
    "power_estimate": null,
    "power_assumptions": null,
    "multiplicity": {
      "family": "primary_signals",
      "m": null,
      "adjustment": "none",
      "p_adjusted": null
    },
    "flags": []
  }
}
```

### Assessment
**Assessment is interpretation.** It MUST NOT be used as a substitute for measurement.

- `assessment.overall.category` is a coarse bucket for ops.
- `assessment.guidance` MUST mention humility flags if present in primary signals.

## Versioning
- `spec_version` is required.
- New fields MUST be additive.
- Breaking changes MUST bump `spec_version`.

## Ethical constraints (v0.1)
- Reports MUST focus on **aggregate/cohort-level** behavior.
- Reports MUST NOT auto-label individuals as “liars” or “bots.”
- If per-account data exists internally, it MUST NOT be emitted in STR by default.
