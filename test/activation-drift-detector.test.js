import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ActivationDriftDetector, trainLogRegProbe } from '../lib/detectors/activation-drift-detector.js';

const mockConfig = {
  analysis: {
    activationDrift: {
      enabled: true,
      threshold: 0.5
    }
  }
};

const mockLogger = {
  info: () => {},
  debug: () => {},
  warn: () => {},
  error: () => {}
};

describe('ActivationDriftDetector', () => {
  it('should compute delta and norm', () => {
    const det = new ActivationDriftDetector(mockConfig, mockLogger);
    const before = [1, 2, 3];
    const after = [2, 0, 7];
    const delta = det.computeDelta(before, after);
    assert.deepStrictEqual(delta, [1, -2, 4]);
    assert(Math.abs(det.l2Norm(delta) - Math.sqrt(21)) < 1e-9);
  });

  it('should score with a linear probe', () => {
    const det = new ActivationDriftDetector(mockConfig, mockLogger);
    const probe = { id: 'unit', weights: [1, 1], bias: 0 };
    const out = det.scoreDelta([1, 1], probe, 0.5);
    assert(out.probability > 0.5);
    assert.strictEqual(out.flagged, true);
  });

  it('should train a tiny probe that separates synthetic drift', () => {
    // Synthetic setup: class 0 deltas near [0,0]; class 1 deltas near [2,2]
    const data = [];
    for (let i = 0; i < 50; i++) {
      data.push({ x: [Math.random() * 0.2, Math.random() * 0.2], y: 0 });
      data.push({ x: [2 + Math.random() * 0.2, 2 + Math.random() * 0.2], y: 1 });
    }

    const probe = trainLogRegProbe(data, { steps: 200, lr: 0.5, l2: 0 });
    const det = new ActivationDriftDetector(mockConfig, mockLogger);

    const clean = det.scoreDelta([0.05, 0.05], probe, 0.5);
    const drift = det.scoreDelta([2.05, 2.05], probe, 0.5);

    assert(clean.probability < 0.5);
    assert(drift.probability > 0.5);
  });
});
