import test from 'node:test';
import assert from 'node:assert/strict';

import { policyPatchFromCalibration } from '../checkers/alignment_policy_patch.js';

test('policy patch generator emits patch from calibration receipt', async () => {
  const calibration = {
    kind: 'alignment_eval_calibration_receipt_v0.1',
    generated_at: '2026-03-18T00:00:00Z',
    recommendations: {
      gate: 0.76,
      lowerBoundGate: 0.73,
      minSampleSize: 30
    }
  };

  const patch = policyPatchFromCalibration(calibration, { onLowSample: 'reject' });
  assert.equal(patch.kind, 'alignment_eval_policy_patch_v0.1');
  assert.equal(patch.policy_patch.alignment_eval.gate, 0.76);
  assert.equal(patch.policy_patch.alignment_eval.lowerBoundGate, 0.73);
  assert.equal(patch.policy_patch.alignment_eval.minSampleSize, 30);
  assert.equal(patch.policy_patch.alignment_eval.onLowSample, 'reject');
});
