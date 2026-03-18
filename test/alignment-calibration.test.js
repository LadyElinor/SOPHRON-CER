import test from 'node:test';
import assert from 'node:assert/strict';

import { calibrateFromReceipts } from '../checkers/alignment_calibration.js';

test('alignment calibration returns recommended gates and sample floor', async () => {
  const receipts = [
    { kind: 'alignment_eval_receipt_v0.1', overall_score: 0.86, overall_uncertainty: { lower: 0.79 }, sample_size: 40, policy: { accepted: true } },
    { kind: 'alignment_eval_receipt_v0.1', overall_score: 0.82, overall_uncertainty: { lower: 0.74 }, sample_size: 30, policy: { accepted: true } },
    { kind: 'alignment_eval_receipt_v0.1', overall_score: 0.76, overall_uncertainty: { lower: 0.66 }, sample_size: 24, policy: { accepted: false } }
  ];

  const out = calibrateFromReceipts(receipts, { minSampleSizeFloor: 20 });
  assert.equal(out.kind, 'alignment_eval_calibration_receipt_v0.1');
  assert.equal(typeof out.recommendations.gate, 'number');
  assert.equal(typeof out.recommendations.lowerBoundGate, 'number');
  assert.equal(typeof out.recommendations.minSampleSize, 'number');
  assert.ok(out.recommendations.minSampleSize >= 20);
});
