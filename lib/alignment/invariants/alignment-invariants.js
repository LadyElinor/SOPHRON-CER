/**
 * Alignment Invariants Validator
 * 
 * Enforces three core alignment invariants:
 * - INV-A: Evidence anchoring
 * - INV-B: Probe determinism
 * - INV-C: Partition stability
 */

export class AlignmentInvariantsValidator {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.violations = [];
  }

  /**
   * Validate all alignment invariants
   * 
   * @param {AlignmentSignals} signals - Derived alignment signals
   * @param {Array<Object>} receipts - Telemetry receipts
   * @param {Object} probeResults - Probe execution results
   * @returns {Object} Validation results
   */
  validate(signals, receipts, probeResults) {
    this.violations = [];

    this.logger.info('Starting alignment invariant validation');

    // Run all invariant checks
    this.validateEvidenceAnchoring(signals);
    this.validateProbeDeterminism(probeResults);
    this.validatePartitionStability(signals, receipts);

    const isValid = this.violations.length === 0;

    if (isValid) {
      this.logger.info('All alignment invariants validated successfully');
    } else {
      this.logger.error({
        violationCount: this.violations.length
      }, 'Alignment invariant violations detected');

      for (const violation of this.violations) {
        this.logger.error({ violation }, 'Alignment invariant violation');
      }
    }

    return {
      valid: isValid,
      violations: this.violations,
      timestamp: Date.now()
    };
  }

  /**
   * Add a violation to the list
   */
  addViolation(invariant, message, details = {}) {
    this.violations.push({
      invariant,
      message,
      details,
      timestamp: Date.now()
    });
  }

  /**
   * INV-A: Evidence Anchoring
   * Any non-zero alignment score must cite ≥1 receipt/probe id
   */
  validateEvidenceAnchoring(signals) {
    const checkSignal = (name, signal, scoreField = 'score') => {
      if (!signal) return;

      const score = signal[scoreField];
      const evidence = signal.evidence;

      // For human signal, use conflict_flags instead of score
      if (name === 'human') {
        if (signal.conflict_flags && signal.conflict_flags.length > 0) {
          if (!evidence || evidence.length === 0) {
            this.addViolation(
              'inv_a_evidence_anchoring',
              `${name} signal has conflict flags but no evidence`,
              { signal: name, conflicts: signal.conflict_flags }
            );
          }
        }
        return;
      }

      // For other signals, check score
      if (score > 0) {
        if (!evidence || evidence.length === 0) {
          this.addViolation(
            'inv_a_evidence_anchoring',
            `${name} signal has non-zero score but no evidence`,
            { signal: name, score }
          );
        } else {
          // Verify evidence has required fields
          for (const ev of evidence) {
            if (!ev.type || !ev.id) {
              this.addViolation(
                'inv_a_evidence_anchoring',
                `${name} signal evidence missing type or id`,
                { signal: name, evidence: ev }
              );
            }
          }
        }
      }
    };

    checkSignal('shift', signals.shift);
    checkSignal('game', signals.game);
    checkSignal('decept', signals.decept);
    checkSignal('corrig', signals.corrig);
    checkSignal('human', signals.human);
  }

  /**
   * INV-B: Probe Determinism
   * Probes must be replayable from seed/config hash + input snapshot
   */
  validateProbeDeterminism(probeResults) {
    if (!probeResults) {
      this.addViolation(
        'inv_b_probe_determinism',
        'No probe results provided',
        {}
      );
      return;
    }

    // Check each probe has required metadata
    const requiredFields = ['id', 'seed', 'configHash', 'inputSnapshot'];

    const checkProbe = (probeName, probe) => {
      if (!probe) return;

      for (const field of requiredFields) {
        if (!(field in probe)) {
          this.addViolation(
            'inv_b_probe_determinism',
            `Probe ${probeName} missing required field: ${field}`,
            { probe: probeName, missing: field }
          );
        }
      }

      // Verify config hash matches current config
      if (probe.configHash && this.config.configHash) {
        if (probe.configHash !== this.config.configHash) {
          this.addViolation(
            'inv_b_probe_determinism',
            `Probe ${probeName} config hash mismatch`,
            {
              probe: probeName,
              expected: this.config.configHash,
              actual: probe.configHash
            }
          );
        }
      }

      // Check seed is reproducible
      if (probe.seed && !this.isValidSeed(probe.seed)) {
        this.addViolation(
          'inv_b_probe_determinism',
          `Probe ${probeName} has invalid seed format`,
          { probe: probeName, seed: probe.seed }
        );
      }
    };

    // Check all probe types
    const probeTypes = [
      'cohortAnalysis',
      'embeddingDrift',
      'metricTracking',
      'rewardAnalysis',
      'morseProbe',
      'consistencyTrap',
      'toolDenial',
      'haltRequest',
      'conflictAudit'
    ];

    for (const probeType of probeTypes) {
      if (probeResults[probeType]) {
        checkProbe(probeType, probeResults[probeType]);
      }
    }
  }

  /**
   * Check if seed is valid (hex string or numeric)
   */
  isValidSeed(seed) {
    if (typeof seed === 'number') return true;
    if (typeof seed === 'string') {
      return /^[0-9a-fA-F]+$/.test(seed) || /^\d+$/.test(seed);
    }
    return false;
  }

  /**
   * INV-C: Partition Stability for Alignment Metrics
   * SHIFT/GAME trends must be computed on stable cohorts
   * (no moving buckets without emitting a cohort-version event)
   */
  validatePartitionStability(signals, receipts) {
    // Check if cohort definitions have changed
    if (signals.shift && signals.shift.detectors.includes('cohort-kl')) {
      const cohortEvents = receipts.filter(r => 
        r.type === 'cohort-version' || r.type === 'cohort-definition'
      );

      if (cohortEvents.length === 0) {
        this.addViolation(
          'inv_c_partition_stability',
          'SHIFT computed on cohorts but no cohort-version events found',
          { detectors: signals.shift.detectors }
        );
      } else {
        // Check cohort versions are tracked
        const latestCohortVersion = cohortEvents[cohortEvents.length - 1];
        if (!latestCohortVersion.cohortHash) {
          this.addViolation(
            'inv_c_partition_stability',
            'Cohort version event missing cohortHash',
            { event: latestCohortVersion }
          );
        }
      }
    }

    // Check for GAME trends on stable partitions
    if (signals.game && signals.game.patterns.includes('metric-hacking')) {
      const partitionEvents = receipts.filter(r => 
        r.type === 'partition-change'
      );

      // If partitions changed, must have partition-version events
      if (partitionEvents.length > 0) {
        const hasVersioning = partitionEvents.every(e => e.partitionHash);
        if (!hasVersioning) {
          this.addViolation(
            'inv_c_partition_stability',
            'Partition changes detected without proper versioning',
            { changeCount: partitionEvents.length }
          );
        }
      }
    }

    // Check temporal consistency for trend detection
    if (signals.shift || signals.game) {
      const timestamps = receipts.map(r => r.timestamp).filter(t => t);
      if (timestamps.length > 0) {
        const sorted = [...timestamps].sort((a, b) => a - b);
        const hasGaps = sorted.some((t, i) => {
          if (i === 0) return false;
          const gap = t - sorted[i - 1];
          return gap > this.config.alignment.maxTemporalGap || 3600000; // 1 hour default
        });

        if (hasGaps) {
          this.addViolation(
            'inv_c_partition_stability',
            'Large temporal gaps in receipt timestamps may affect trend detection',
            { timestamps: sorted }
          );
        }
      }
    }
  }

  /**
   * Generate validation report
   */
  generateReport() {
    const report = {
      summary: {
        valid: this.violations.length === 0,
        totalViolations: this.violations.length,
        violationsByInvariant: {}
      },
      violations: this.violations,
      invariants: {
        inv_a: {
          name: 'Evidence Anchoring',
          description: 'Any non-zero alignment score must cite ≥1 receipt/probe id',
          status: this.violations.filter(v => v.invariant === 'inv_a_evidence_anchoring').length === 0 ? 'PASS' : 'FAIL'
        },
        inv_b: {
          name: 'Probe Determinism',
          description: 'Probes must be replayable from seed/config hash + input snapshot',
          status: this.violations.filter(v => v.invariant === 'inv_b_probe_determinism').length === 0 ? 'PASS' : 'FAIL'
        },
        inv_c: {
          name: 'Partition Stability',
          description: 'SHIFT/GAME trends must be computed on stable cohorts',
          status: this.violations.filter(v => v.invariant === 'inv_c_partition_stability').length === 0 ? 'PASS' : 'FAIL'
        }
      }
    };

    // Group violations by invariant
    for (const violation of this.violations) {
      if (!report.summary.violationsByInvariant[violation.invariant]) {
        report.summary.violationsByInvariant[violation.invariant] = 0;
      }
      report.summary.violationsByInvariant[violation.invariant]++;
    }

    return report;
  }

  /**
   * Throw error if validation failed and config requires it
   */
  throwIfInvalid() {
    if (this.violations.length > 0 && this.config.alignment.failOnViolation) {
      const report = this.generateReport();
      throw new Error(
        `Alignment invariant validation failed with ${this.violations.length} violations:\n` +
        JSON.stringify(report, null, 2)
      );
    }
  }
}
