/**
 * Invariant validator for CER-Telemetry contracts
 * Enforces determinism, monotonic gating, partition sanity, and denominator hygiene
 */
export class InvariantValidator {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.violations = [];
  }

  /**
   * Validate all invariants
   * @param {Object} data - Data to validate
   * @param {Object} metadata - Analysis metadata
   * @returns {Object} Validation results
   */
  validate(data, metadata) {
    this.violations = [];

    this.logger.info('Starting invariant validation');

    // Run all validation checks
    this.validateDeterminism(metadata);
    this.validateMonotonicGating(data);
    this.validatePartitionSanity(data);
    this.validateDenominatorHygiene(data);
    this.validateProvenanceCompleteness(metadata);
    this.validateNoNaNInf(data);
    this.validateTemporalConsistency(data);

    const isValid = this.violations.length === 0;

    if (isValid) {
      this.logger.info('All invariants validated successfully');
    } else {
      this.logger.error({ 
        violationCount: this.violations.length 
      }, 'Invariant violations detected');
      
      for (const violation of this.violations) {
        this.logger.error({ violation }, 'Invariant violation');
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
   * @param {string} invariant - Invariant name
   * @param {string} message - Violation message
   * @param {Object} details - Additional details
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
   * Validate determinism - same inputs should produce same outputs
   * @param {Object} metadata - Analysis metadata
   */
  validateDeterminism(metadata) {
    if (!metadata.configHash) {
      this.addViolation(
        'determinism',
        'Missing configuration hash for reproducibility',
        { metadata }
      );
    }

    if (!metadata.codeVersion) {
      this.addViolation(
        'determinism',
        'Missing code version for reproducibility',
        { metadata }
      );
    }
  }

  /**
   * Validate monotonic gating - minimum impression thresholds
   * @param {Object} data - Analysis data
   */
  validateMonotonicGating(data) {
    if (!data.summary) return;

    const { uniquePosts, rawPosts } = data.summary;

    if (uniquePosts < this.config.sampling.minSampleSize) {
      this.addViolation(
        'monotonic_gating',
        'Sample size below minimum threshold',
        { 
          uniquePosts, 
          minRequired: this.config.sampling.minSampleSize 
        }
      );
    }

    // Check each block meets minimum size
    if (data.blocks) {
      for (const [blockKey, block] of Object.entries(data.blocks)) {
        if (block.sampleSize < this.config.analysis.minBlockSize) {
          this.addViolation(
            'monotonic_gating',
            'Block size below minimum threshold',
            { 
              blockKey, 
              size: block.sampleSize, 
              minRequired: this.config.analysis.minBlockSize 
            }
          );
        }
      }
    }
  }

  /**
   * Validate partition sanity - blocks should be well-defined and non-overlapping
   * @param {Object} data - Analysis data
   */
  validatePartitionSanity(data) {
    if (!data.blocks || !data.summary) return;

    const blockSizes = Object.values(data.blocks).map(b => b.sampleSize);
    const totalInBlocks = blockSizes.reduce((sum, size) => sum + size, 0);
    const expectedTotal = data.summary.uniquePosts;

    // Allow for some posts not fitting into blocks (e.g., filtered out)
    if (totalInBlocks > expectedTotal) {
      this.addViolation(
        'partition_sanity',
        'Total posts in blocks exceeds unique posts',
        { 
          totalInBlocks, 
          expectedTotal,
          difference: totalInBlocks - expectedTotal
        }
      );
    }

    // Check for empty blocks
    for (const [blockKey, block] of Object.entries(data.blocks)) {
      if (block.sampleSize === 0) {
        this.addViolation(
          'partition_sanity',
          'Empty block detected',
          { blockKey }
        );
      }
    }
  }

  /**
   * Validate denominator hygiene - no division by zero, NaN, or Inf
   * @param {Object} data - Analysis data
   */
  validateDenominatorHygiene(data) {
    const checkValue = (value, path) => {
      if (typeof value !== 'number') return;

      if (isNaN(value)) {
        this.addViolation(
          'denominator_hygiene',
          'NaN value detected',
          { path, value }
        );
      }

      if (!isFinite(value)) {
        this.addViolation(
          'denominator_hygiene',
          'Infinite value detected',
          { path, value }
        );
      }
    };

    const traverse = (obj, path = '') => {
      if (obj === null || obj === undefined) return;

      if (typeof obj === 'number') {
        checkValue(obj, path);
        return;
      }

      if (Array.isArray(obj)) {
        obj.forEach((item, i) => traverse(item, `${path}[${i}]`));
        return;
      }

      if (typeof obj === 'object') {
        for (const [key, value] of Object.entries(obj)) {
          traverse(value, path ? `${path}.${key}` : key);
        }
      }
    };

    traverse(data);
  }

  /**
   * Validate provenance completeness - all required metadata present
   * @param {Object} metadata - Analysis metadata
   */
  validateProvenanceCompleteness(metadata) {
    const requiredFields = [
      'runId',
      'timestamp',
      'config',
      'codeVersion',
      'nodeVersion'
    ];

    for (const field of requiredFields) {
      if (!(field in metadata)) {
        this.addViolation(
          'provenance_completeness',
          `Missing required metadata field: ${field}`,
          { field, metadata }
        );
      }
    }
  }

  /**
   * Validate no NaN or Inf in critical paths
   * @param {Object} data - Analysis data
   */
  validateNoNaNInf(data) {
    if (!data.blocks) return;

    for (const [blockKey, block] of Object.entries(data.blocks)) {
      // Check prevalences
      if (block.prevalences) {
        for (const [feature, prev] of Object.entries(block.prevalences)) {
          if (isNaN(prev.prevalence) || !isFinite(prev.prevalence)) {
            this.addViolation(
              'no_nan_inf',
              'Invalid prevalence value',
              { blockKey, feature, value: prev.prevalence }
            );
          }

          if (prev.total === 0) {
            this.addViolation(
              'no_nan_inf',
              'Zero denominator in prevalence calculation',
              { blockKey, feature }
            );
          }
        }
      }
    }
  }

  /**
   * Validate temporal consistency
   * @param {Object} data - Analysis data
   */
  validateTemporalConsistency(data) {
    if (!data.blocks) return;

    for (const [blockKey, block] of Object.entries(data.blocks)) {
      if (!block.metadata) continue;

      const { firstTimestamp, lastTimestamp } = block.metadata;

      if (firstTimestamp > lastTimestamp) {
        this.addViolation(
          'temporal_consistency',
          'First timestamp after last timestamp',
          { blockKey, firstTimestamp, lastTimestamp }
        );
      }

      // Check for timestamps in the future
      const now = Date.now();
      if (lastTimestamp > now + 60000) { // Allow 1 minute clock skew
        this.addViolation(
          'temporal_consistency',
          'Timestamp in the future',
          { blockKey, lastTimestamp, now }
        );
      }
    }
  }

  /**
   * Generate validation report
   * @returns {Object} Human-readable report
   */
  generateReport() {
    const report = {
      summary: {
        valid: this.violations.length === 0,
        totalViolations: this.violations.length,
        violationsByInvariant: {}
      },
      violations: this.violations
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
    if (this.violations.length > 0 && this.config.validation.failOnViolation) {
      const report = this.generateReport();
      throw new Error(
        `Invariant validation failed with ${this.violations.length} violations:\n` +
        JSON.stringify(report, null, 2)
      );
    }
  }
}
