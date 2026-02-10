import { describe, it } from 'node:test';
import assert from 'node:assert';
import { StatisticalAnalyzer } from '../lib/analyzers/statistical-analyzer.js';

const mockConfig = {
  analysis: {
    confidenceLevel: 0.95,
    minBlockSize: 30
  }
};

const mockLogger = {
  info: () => {},
  debug: () => {},
  warn: () => {},
  error: () => {}
};

describe('StatisticalAnalyzer', () => {
  describe('wilsonConfidenceInterval', () => {
    it('should calculate correct confidence interval', () => {
      const analyzer = new StatisticalAnalyzer(mockConfig, mockLogger);
      const result = analyzer.wilsonConfidenceInterval(50, 100);

      assert.strictEqual(result.point, 0.5);
      assert(result.lower > 0.4 && result.lower < 0.5);
      assert(result.upper > 0.5 && result.upper < 0.6);
    });

    it('should handle edge case with zero total', () => {
      const analyzer = new StatisticalAnalyzer(mockConfig, mockLogger);
      const result = analyzer.wilsonConfidenceInterval(0, 0);

      assert.strictEqual(result.point, 0);
      assert.strictEqual(result.lower, 0);
      assert.strictEqual(result.upper, 0);
    });

    it('should handle 100% prevalence', () => {
      const analyzer = new StatisticalAnalyzer(mockConfig, mockLogger);
      const result = analyzer.wilsonConfidenceInterval(100, 100);

      assert.strictEqual(result.point, 1);
      assert(result.lower > 0.9);
      assert.strictEqual(result.upper, 1);
    });
  });

  describe('cohensH', () => {
    it('should detect negligible effect', () => {
      const analyzer = new StatisticalAnalyzer(mockConfig, mockLogger);
      const result = analyzer.cohensH(0.50, 0.51);

      assert.strictEqual(result.interpretation, 'negligible');
    });

    it('should detect medium effect', () => {
      const analyzer = new StatisticalAnalyzer(mockConfig, mockLogger);
      const result = analyzer.cohensH(0.30, 0.50);

      assert.strictEqual(result.interpretation, 'medium');
    });

    it('should detect large effect', () => {
      const analyzer = new StatisticalAnalyzer(mockConfig, mockLogger);
      const result = analyzer.cohensH(0.20, 0.60);

      assert.strictEqual(result.interpretation, 'large');
    });
  });

  describe('chiSquareTest', () => {
    it('should detect significant difference', () => {
      const analyzer = new StatisticalAnalyzer(mockConfig, mockLogger);
      const observed = [
        [60, 40],
        [30, 70]
      ];
      const result = analyzer.chiSquareTest(observed);

      assert.strictEqual(result.significant, true);
      assert(result.chiSquare > 3.841); // Critical value at p=0.05
    });

    it('should detect non-significant difference', () => {
      const analyzer = new StatisticalAnalyzer(mockConfig, mockLogger);
      const observed = [
        [50, 50],
        [48, 52]
      ];
      const result = analyzer.chiSquareTest(observed);

      assert.strictEqual(result.significant, false);
    });

    it('should return numeric pValue for df=1', () => {
      const analyzer = new StatisticalAnalyzer(mockConfig, mockLogger);
      const observed = [
        [60, 40],
        [30, 70]
      ];
      const result = analyzer.chiSquareTest(observed);

      assert.strictEqual(result.df, 1);
      assert(typeof result.pValueNumeric === 'number');
      assert(result.pValueNumeric >= 0 && result.pValueNumeric <= 1);
      assert(result.pValueNumeric < 0.05);
    });
  });

  describe('weightedPrevalence', () => {
    it('should calculate weighted average correctly', () => {
      const analyzer = new StatisticalAnalyzer(mockConfig, mockLogger);
      const items = [
        { count: 1, weight: 100 },  // High weight, has feature
        { count: 1, weight: 100 },
        { count: 0, weight: 10 },   // Low weight, no feature
        { count: 0, weight: 10 }
      ];
      const result = analyzer.weightedPrevalence(items);

      // Should be close to (100+100)/(100+100+10+10) = 200/220 ≈ 0.91
      assert(result.prevalence > 0.9);
      assert.strictEqual(result.totalWeight, 220);
    });

    it('should handle zero weight', () => {
      const analyzer = new StatisticalAnalyzer(mockConfig, mockLogger);
      const items = [];
      const result = analyzer.weightedPrevalence(items);

      assert.strictEqual(result.prevalence, 0);
      assert.strictEqual(result.totalWeight, 0);
    });
  });

  describe('mannKendallTest', () => {
    it('should detect increasing trend', () => {
      const analyzer = new StatisticalAnalyzer(mockConfig, mockLogger);
      const timeSeries = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = analyzer.mannKendallTest(timeSeries);

      assert.strictEqual(result.trend, 'increasing');
      assert.strictEqual(result.significant, true);
    });

    it('should detect decreasing trend', () => {
      const analyzer = new StatisticalAnalyzer(mockConfig, mockLogger);
      const timeSeries = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
      const result = analyzer.mannKendallTest(timeSeries);

      assert.strictEqual(result.trend, 'decreasing');
      assert.strictEqual(result.significant, true);
    });

    it('should detect no trend', () => {
      const analyzer = new StatisticalAnalyzer(mockConfig, mockLogger);
      const timeSeries = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
      const result = analyzer.mannKendallTest(timeSeries);

      assert.strictEqual(result.trend, 'no_trend');
      assert.strictEqual(result.significant, false);
    });

    it('should handle insufficient data', () => {
      const analyzer = new StatisticalAnalyzer(mockConfig, mockLogger);
      const timeSeries = [1, 2];
      const result = analyzer.mannKendallTest(timeSeries);

      assert.strictEqual(result.trend, 'insufficient_data');
    });
  });

  describe('summarize', () => {
    it('should calculate summary statistics', () => {
      const analyzer = new StatisticalAnalyzer(mockConfig, mockLogger);
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = analyzer.summarize(data);

      assert.strictEqual(result.count, 10);
      assert.strictEqual(result.mean, 5.5);
      assert.strictEqual(result.median, 5.5);
      assert.strictEqual(result.min, 1);
      assert.strictEqual(result.max, 10);
    });

    it('should handle empty array', () => {
      const analyzer = new StatisticalAnalyzer(mockConfig, mockLogger);
      const result = analyzer.summarize([]);

      assert.strictEqual(result.count, 0);
      assert.strictEqual(result.mean, null);
    });
  });

  describe('relativeRisk', () => {
    it('should calculate relative risk correctly', () => {
      const analyzer = new StatisticalAnalyzer(mockConfig, mockLogger);
      // Exposed: 60/100 = 0.6, Unexposed: 30/100 = 0.3
      const result = analyzer.relativeRisk(60, 40, 30, 70);

      assert.strictEqual(result.relativeRisk, 2); // 0.6 / 0.3 = 2
      assert.strictEqual(result.riskExposed, 0.6);
      assert.strictEqual(result.riskUnexposed, 0.3);
      assert(result.confidence.lower > 0);
      assert(result.confidence.upper > result.relativeRisk);
    });
  });

  describe('benjaminiHochberg', () => {
    it('should compute q-values and rejection set', () => {
      const analyzer = new StatisticalAnalyzer(mockConfig, mockLogger);
      const p = [0.001, 0.02, 0.04, 0.2, null];
      const { qValues, rejected, k } = analyzer.benjaminiHochberg(p, 0.05);

      assert.strictEqual(qValues.length, p.length);
      assert.strictEqual(rejected.length, p.length);

      // null should stay null
      assert.strictEqual(qValues[4], null);
      assert.strictEqual(rejected[4], false);

      // The smallest p-values should be rejected
      assert.strictEqual(rejected[0], true);
      assert.strictEqual(rejected[1], true);

      // Large p should not be rejected
      assert.strictEqual(rejected[3], false);
      assert(k >= 2);

      // q-values should be monotone after sorting; spot-check basic bounds
      assert(qValues[0] <= 0.01);
      assert(qValues[3] >= 0.2);
    });
  });
});
