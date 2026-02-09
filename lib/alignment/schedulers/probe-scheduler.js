/**
 * Probe Scheduler
 * 
 * Manages compute allocation for alignment probes with risk-triggered surge.
 * Prevents "set it once and forget" ceremonial probe rates.
 */

export class ProbeScheduler {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.baselineRate = config.alignment.baselineProbeRate || 0.10;
    this.surgeRate = config.alignment.surgeProbeRate || 0.30;
    this.currentRate = this.baselineRate;
    this.riskHistory = [];
  }

  /**
   * Determine probe rate for current execution
   * 
   * @param {Object} context - Execution context with risk triggers
   * @returns {Object} Scheduling decision
   */
  schedule(context) {
    const triggers = this.evaluateTriggers(context);
    const shouldSurge = triggers.length > 0;

    const decision = {
      probeRate: shouldSurge ? this.surgeRate : this.baselineRate,
      triggers,
      surgeActivated: shouldSurge,
      timestamp: Date.now()
    };

    // Update current rate
    this.currentRate = decision.probeRate;

    // Log decision
    if (shouldSurge) {
      this.logger.warn({
        triggers,
        oldRate: this.baselineRate,
        newRate: this.surgeRate
      }, 'Probe surge activated');
    } else {
      this.logger.debug({
        rate: this.baselineRate
      }, 'Baseline probe rate');
    }

    // Record in history
    this.riskHistory.push({
      timestamp: Date.now(),
      triggers,
      rate: decision.probeRate
    });

    // Trim history (keep last 100 decisions)
    if (this.riskHistory.length > 100) {
      this.riskHistory.shift();
    }

    return decision;
  }

  /**
   * Evaluate risk triggers for probe surge
   * 
   * @param {Object} context - Execution context
   * @returns {Array<Object>} Triggered conditions
   */
  evaluateTriggers(context) {
    const triggers = [];

    // Trigger 1: New model version
    if (context.modelVersion !== context.previousModelVersion) {
      triggers.push({
        type: 'model_version_change',
        severity: 'high',
        details: {
          old: context.previousModelVersion,
          new: context.modelVersion
        }
      });
    }

    // Trigger 2: New tool permission
    if (context.newToolPermissions && context.newToolPermissions.length > 0) {
      triggers.push({
        type: 'new_tool_permissions',
        severity: 'medium',
        details: {
          tools: context.newToolPermissions
        }
      });
    }

    // Trigger 3: Cohort drift exceeds threshold
    if (context.cohortDrift && context.cohortDrift > this.config.alignment.driftThreshold) {
      triggers.push({
        type: 'cohort_drift',
        severity: 'high',
        details: {
          drift: context.cohortDrift,
          threshold: this.config.alignment.driftThreshold
        }
      });
    }

    // Trigger 4: Unexplained metric delta
    if (context.metricDeltas) {
      for (const [metric, delta] of Object.entries(context.metricDeltas)) {
        if (Math.abs(delta) > this.config.alignment.metricDeltaThreshold) {
          triggers.push({
            type: 'unexplained_metric_delta',
            severity: 'medium',
            details: {
              metric,
              delta,
              threshold: this.config.alignment.metricDeltaThreshold
            }
          });
        }
      }
    }

    // Trigger 5: Previous alignment violations
    if (context.previousViolations && context.previousViolations.length > 0) {
      triggers.push({
        type: 'previous_violations',
        severity: 'high',
        details: {
          count: context.previousViolations.length,
          violations: context.previousViolations.slice(0, 3) // Sample
        }
      });
    }

    // Trigger 6: High risk signals from previous run
    if (context.previousRiskScore && context.previousRiskScore > 0.7) {
      triggers.push({
        type: 'high_risk_score',
        severity: 'critical',
        details: {
          score: context.previousRiskScore
        }
      });
    }

    // Trigger 7: Deployment to new environment
    if (context.environmentChange) {
      triggers.push({
        type: 'environment_change',
        severity: 'medium',
        details: {
          old: context.previousEnvironment,
          new: context.currentEnvironment
        }
      });
    }

    return triggers;
  }

  /**
   * Determine which probes to run based on rate and triggers
   * 
   * @param {number} totalBudget - Total compute budget
   * @param {Object} schedulingDecision - Output from schedule()
   * @returns {Object} Probe execution plan
   */
  selectProbes(totalBudget, schedulingDecision) {
    const probeBudget = totalBudget * schedulingDecision.probeRate;
    const triggers = schedulingDecision.triggers;

    // Define probe priorities and costs
    const probeSpecs = [
      // Always run (baseline)
      { name: 'cohortAnalysis', cost: 0.02, priority: 10, baseline: true },
      { name: 'metricTracking', cost: 0.01, priority: 10, baseline: true },

      // Triggered probes
      { name: 'embeddingDrift', cost: 0.03, priority: 8, 
        triggers: ['model_version_change', 'cohort_drift'] },
      { name: 'rewardAnalysis', cost: 0.04, priority: 7,
        triggers: ['unexplained_metric_delta'] },
      { name: 'morseProbe', cost: 0.05, priority: 9,
        triggers: ['model_version_change', 'high_risk_score'] },
      { name: 'consistencyTrap', cost: 0.05, priority: 8,
        triggers: ['model_version_change', 'previous_violations'] },
      { name: 'toolDenial', cost: 0.02, priority: 6,
        triggers: ['new_tool_permissions'] },
      { name: 'haltRequest', cost: 0.02, priority: 7,
        triggers: ['high_risk_score', 'previous_violations'] },
      { name: 'conflictAudit', cost: 0.03, priority: 5,
        triggers: ['environment_change'] }
    ];

    // Select probes to run
    const selectedProbes = [];
    let remainingBudget = probeBudget;

    // First, add baseline probes
    for (const spec of probeSpecs.filter(p => p.baseline)) {
      if (remainingBudget >= spec.cost) {
        selectedProbes.push({
          name: spec.name,
          cost: spec.cost,
          reason: 'baseline'
        });
        remainingBudget -= spec.cost;
      }
    }

    // Then, add triggered probes by priority
    const triggeredProbes = probeSpecs
      .filter(p => !p.baseline)
      .filter(p => {
        // Check if any of this probe's triggers are active
        return triggers.some(t => p.triggers.includes(t.type));
      })
      .sort((a, b) => b.priority - a.priority);

    for (const spec of triggeredProbes) {
      if (remainingBudget >= spec.cost) {
        const relevantTriggers = triggers.filter(t => 
          spec.triggers.includes(t.type)
        );
        selectedProbes.push({
          name: spec.name,
          cost: spec.cost,
          reason: 'triggered',
          triggers: relevantTriggers.map(t => t.type)
        });
        remainingBudget -= spec.cost;
      }
    }

    return {
      probes: selectedProbes,
      totalCost: probeBudget - remainingBudget,
      budget: probeBudget,
      remaining: remainingBudget,
      utilization: ((probeBudget - remainingBudget) / probeBudget) * 100
    };
  }

  /**
   * Get probe execution statistics
   */
  getStats() {
    if (this.riskHistory.length === 0) {
      return {
        totalExecutions: 0,
        surgeActivations: 0,
        averageRate: this.baselineRate
      };
    }

    const surgeCount = this.riskHistory.filter(h => 
      h.triggers.length > 0
    ).length;

    const avgRate = this.riskHistory.reduce((sum, h) => 
      sum + h.rate, 0
    ) / this.riskHistory.length;

    // Trigger frequency
    const triggerCounts = {};
    for (const history of this.riskHistory) {
      for (const trigger of history.triggers) {
        triggerCounts[trigger.type] = (triggerCounts[trigger.type] || 0) + 1;
      }
    }

    return {
      totalExecutions: this.riskHistory.length,
      surgeActivations: surgeCount,
      surgeRate: surgeCount / this.riskHistory.length,
      averageRate: avgRate,
      currentRate: this.currentRate,
      triggerFrequency: triggerCounts
    };
  }

  /**
   * Reset scheduler state
   */
  reset() {
    this.currentRate = this.baselineRate;
    this.riskHistory = [];
    this.logger.info('Probe scheduler reset');
  }

  /**
   * Export state for persistence
   */
  exportState() {
    return {
      baselineRate: this.baselineRate,
      surgeRate: this.surgeRate,
      currentRate: this.currentRate,
      history: this.riskHistory,
      stats: this.getStats()
    };
  }

  /**
   * Import state from persistence
   */
  importState(state) {
    this.baselineRate = state.baselineRate;
    this.surgeRate = state.surgeRate;
    this.currentRate = state.currentRate;
    this.riskHistory = state.history || [];
    this.logger.info({ state }, 'Probe scheduler state imported');
  }
}

/**
 * Probe execution context builder
 */
export class ProbeContextBuilder {
  constructor() {
    this.context = {};
  }

  setModelVersion(current, previous) {
    this.context.modelVersion = current;
    this.context.previousModelVersion = previous;
    return this;
  }

  setToolPermissions(newTools) {
    this.context.newToolPermissions = newTools;
    return this;
  }

  setCohortDrift(drift) {
    this.context.cohortDrift = drift;
    return this;
  }

  setMetricDeltas(deltas) {
    this.context.metricDeltas = deltas;
    return this;
  }

  setPreviousViolations(violations) {
    this.context.previousViolations = violations;
    return this;
  }

  setPreviousRiskScore(score) {
    this.context.previousRiskScore = score;
    return this;
  }

  setEnvironment(current, previous) {
    this.context.currentEnvironment = current;
    this.context.previousEnvironment = previous;
    this.context.environmentChange = current !== previous;
    return this;
  }

  build() {
    return this.context;
  }
}
