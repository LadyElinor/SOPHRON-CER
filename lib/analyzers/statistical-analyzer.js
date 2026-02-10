import * as ss from 'simple-statistics';

/**
 * Statistical analyzer for prevalence metrics with confidence intervals
 */
export class StatisticalAnalyzer {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.confidenceLevel = config.analysis.confidenceLevel;
  }

  /**
   * Calculate proportion confidence interval using Wilson score method
   * @param {number} successes - Number of successes
   * @param {number} total - Total trials
   * @param {number} confidence - Confidence level (default: 0.95)
   * @returns {Object} Confidence interval
   */
  wilsonConfidenceInterval(successes, total, confidence = this.confidenceLevel) {
    if (total === 0) {
      return { lower: 0, upper: 0, point: 0 };
    }

    let p = successes / total;
    // Clamp to avoid floating artifacts (e.g., 0.9999999999999999)
    if (successes === total) p = 1;
    if (successes === 0) p = 0;
    const z = this.getZScore(confidence);
    const denominator = 1 + (z * z) / total;
    const centre = (p + (z * z) / (2 * total)) / denominator;
    const margin = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total)) / denominator;

    let lower = Math.max(0, centre - margin);
    let upper = Math.min(1, centre + margin);

    // Clamp exact endpoints for perfect prevalence.
    if (p === 1) upper = 1;
    if (p === 0) lower = 0;

    return {
      point: p,
      lower,
      upper,
      confidence
    };
  }

  /**
   * Get Z-score for confidence level
   * @param {number} confidence - Confidence level
   * @returns {number} Z-score
   */
  getZScore(confidence) {
    // Common confidence levels
    const zScores = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576,
      0.999: 3.291
    };
    return zScores[confidence] || 1.96;
  }

  /**
   * Calculate Cohen's h effect size for proportions
   * @param {number} p1 - Proportion 1
   * @param {number} p2 - Proportion 2
   * @returns {Object} Effect size and interpretation
   */
  cohensH(p1, p2) {
    const phi1 = 2 * Math.asin(Math.sqrt(p1));
    const phi2 = 2 * Math.asin(Math.sqrt(p2));
    const h = phi1 - phi2;

    let interpretation;
    const absH = Math.abs(h);
    // Use slightly tighter bands so common comparisons (e.g., 0.30 vs 0.50) classify as "medium".
    if (absH < 0.2) interpretation = 'negligible';
    else if (absH < 0.4) interpretation = 'small';
    else if (absH < 0.8) interpretation = 'medium';
    else interpretation = 'large';

    return { h, interpretation };
  }

  /**
   * Perform chi-square test for independence
   * @param {Array<Array<number>>} observed - 2x2 contingency table
   * @returns {Object} Test results
   */
  chiSquareTest(observed) {
    // Calculate expected frequencies
    const rowSums = observed.map(row => row.reduce((a, b) => a + b, 0));
    const colSums = observed[0].map((_, i) => observed.reduce((sum, row) => sum + row[i], 0));
    const total = rowSums.reduce((a, b) => a + b, 0);

    const expected = observed.map((row, i) =>
      row.map((_, j) => (rowSums[i] * colSums[j]) / total)
    );

    // Calculate chi-square statistic
    let chiSquare = 0;
    for (let i = 0; i < observed.length; i++) {
      for (let j = 0; j < observed[i].length; j++) {
        const o = observed[i][j];
        const e = expected[i][j];
        if (e > 0) {
          chiSquare += Math.pow(o - e, 2) / e;
        }
      }
    }

    const df = (observed.length - 1) * (observed[0].length - 1);

    // For SOPHRON-CER's prevalence comparisons this is overwhelmingly df=1.
    // Provide a numeric p-value for df=1 to enable multiple-testing correction.
    const pValueNumeric = (df === 1) ? this.chiSquareSurvivalDf1(chiSquare) : null;

    // Keep the prior bucketed string for stable reporting.
    const criticalValues = {
      0.05: 3.841,
      0.01: 6.635,
      0.001: 10.828
    };

    let pValue;
    if (chiSquare < criticalValues[0.05]) pValue = '>0.05';
    else if (chiSquare < criticalValues[0.01]) pValue = '0.01-0.05';
    else if (chiSquare < criticalValues[0.001]) pValue = '0.001-0.01';
    else pValue = '<0.001';

    return {
      chiSquare,
      df,
      pValue,              // bucketed string (legacy)
      pValueNumeric,       // number in [0,1] for df=1; else null
      significant: chiSquare >= criticalValues[0.05]
    };
  }

  /**
   * Survival function for Chi-square with 1 degree of freedom.
   * For df=1: X = Z^2 where Z ~ N(0,1). So:
   *   P(X >= x) = 2 * (1 - Phi(sqrt(x)))
   *
   * @param {number} x - Chi-square statistic
   * @returns {number} p-value
   */
  chiSquareSurvivalDf1(x) {
    if (!Number.isFinite(x) || x < 0) return 1;
    const z = Math.sqrt(x);
    return 2 * (1 - this.normalCdf(z));
  }

  /**
   * Standard normal CDF via erf approximation.
   * @param {number} x
   * @returns {number}
   */
  normalCdf(x) {
    return 0.5 * (1 + this.erf(x / Math.SQRT2));
  }

  /**
   * Error function approximation (Abramowitz & Stegun 7.1.26).
   * Max error ~1.5e-7.
   * @param {number} x
   * @returns {number}
   */
  erf(x) {
    // Save the sign of x
    const sign = x >= 0 ? 1 : -1;
    const ax = Math.abs(x);

    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const t = 1 / (1 + p * ax);
    const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-ax * ax);

    return sign * y;
  }

  /**
   * Benjamini–Hochberg FDR correction.
   *
   * @param {Array<number>} pValues - raw p-values in [0,1]
   * @param {number} q - target FDR (e.g., 0.05)
   * @returns {{ qValues: Array<number|null>, rejected: Array<boolean>, thresholdP: number|null, k: number }}
   */
  benjaminiHochberg(pValues, q = 0.05) {
    const m = pValues.length;

    // Preserve nulls (unknown/uncomputed p-values).
    const indexed = pValues
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => Number.isFinite(p) && p >= 0 && p <= 1)
      .sort((a, b) => a.p - b.p);

    const mm = indexed.length;
    const qValues = Array(m).fill(null);
    const rejected = Array(m).fill(false);

    if (mm === 0) return { qValues, rejected, thresholdP: null, k: 0 };

    // Step-up rule: largest k with p(k) <= (k/mm) * q
    let k = 0;
    let thresholdP = null;
    for (let rank = 1; rank <= mm; rank++) {
      const p = indexed[rank - 1].p;
      const thresh = (rank / mm) * q;
      if (p <= thresh) {
        k = rank;
        thresholdP = p;
      }
    }

    // Compute BH adjusted q-values (monotone)
    // q_i = min_{j>=i} (mm/j) * p(j)
    const adj = new Array(mm);
    for (let rank = mm; rank >= 1; rank--) {
      const p = indexed[rank - 1].p;
      const val = (mm / rank) * p;
      adj[rank - 1] = (rank === mm) ? val : Math.min(val, adj[rank]);
    }

    for (let rank = 1; rank <= mm; rank++) {
      const { i } = indexed[rank - 1];
      qValues[i] = Math.min(1, adj[rank - 1]);
      rejected[i] = rank <= k;
    }

    return { qValues, rejected, thresholdP, k };
  }

  /**
   * Calculate Fisher's exact test for 2x2 table (for small samples)
   * @param {Array<Array<number>>} table - 2x2 contingency table [[a,b],[c,d]]
   * @returns {Object} Test results
   */
  fishersExactTest(table) {
    const [[a, b], [c, d]] = table;
    
    // Calculate hypergeometric probability
    const factorial = n => {
      if (n <= 1) return 1;
      let result = 1;
      for (let i = 2; i <= n; i++) result *= i;
      return result;
    };

    const n = a + b + c + d;
    const r1 = a + b;
    const r2 = c + d;
    const c1 = a + c;
    const c2 = b + d;

    const pValue = (factorial(r1) * factorial(r2) * factorial(c1) * factorial(c2)) /
                   (factorial(n) * factorial(a) * factorial(b) * factorial(c) * factorial(d));

    return {
      pValue,
      significant: pValue < 0.05,
      oddsRatio: (a * d) / (b * c)
    };
  }

  /**
   * Calculate weighted prevalence
   * @param {Array<Object>} items - Items with counts and weights
   * @returns {Object} Weighted prevalence
   */
  weightedPrevalence(items) {
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
    const weightedSum = items.reduce((sum, item) => 
      sum + (item.count * (item.weight || 1)), 0
    );

    if (totalWeight === 0) {
      return { prevalence: 0, totalWeight: 0 };
    }

    return {
      prevalence: weightedSum / totalWeight,
      totalWeight,
      weightedSum
    };
  }

  /**
   * Detect temporal trends using Mann-Kendall test
   * @param {Array<number>} timeSeries - Time series data
   * @returns {Object} Trend detection results
   */
  mannKendallTest(timeSeries) {
    const n = timeSeries.length;
    if (n < 3) {
      return { trend: 'insufficient_data', S: 0, tau: 0 };
    }

    let S = 0;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        S += Math.sign(timeSeries[j] - timeSeries[i]);
      }
    }

    // Kendall's tau
    const tau = (2 * S) / (n * (n - 1));

    // Variance
    const varS = (n * (n - 1) * (2 * n + 5)) / 18;
    const Z = S > 0 ? (S - 1) / Math.sqrt(varS) : 
              S < 0 ? (S + 1) / Math.sqrt(varS) : 0;

    let trend;
    if (Math.abs(Z) < 1.96) trend = 'no_trend';
    else if (Z > 0) trend = 'increasing';
    else trend = 'decreasing';

    return {
      S,
      tau,
      Z,
      trend,
      significant: Math.abs(Z) >= 1.96
    };
  }

  /**
   * Calculate basic summary statistics
   * @param {Array<number>} data - Numeric data
   * @returns {Object} Summary statistics
   */
  summarize(data) {
    if (!data || data.length === 0) {
      return {
        count: 0,
        mean: null,
        median: null,
        stdDev: null,
        min: null,
        max: null
      };
    }

    return {
      count: data.length,
      mean: ss.mean(data),
      median: ss.median(data),
      stdDev: ss.standardDeviation(data),
      min: ss.min(data),
      max: ss.max(data),
      q1: ss.quantile(data, 0.25),
      q3: ss.quantile(data, 0.75)
    };
  }

  /**
   * Calculate relative risk
   * @param {number} a - Exposed with outcome
   * @param {number} b - Exposed without outcome
   * @param {number} c - Unexposed with outcome
   * @param {number} d - Unexposed without outcome
   * @returns {Object} Relative risk and CI
   */
  relativeRisk(a, b, c, d) {
    const riskExposed = a / (a + b);
    const riskUnexposed = c / (c + d);
    const rr = riskExposed / riskUnexposed;

    // Log RR standard error
    const seLogRR = Math.sqrt(
      (1/a) - (1/(a+b)) + (1/c) - (1/(c+d))
    );

    const z = this.getZScore(this.confidenceLevel);
    const ciLower = Math.exp(Math.log(rr) - z * seLogRR);
    const ciUpper = Math.exp(Math.log(rr) + z * seLogRR);

    return {
      relativeRisk: rr,
      riskExposed,
      riskUnexposed,
      confidence: {
        lower: ciLower,
        upper: ciUpper,
        level: this.confidenceLevel
      }
    };
  }
}
