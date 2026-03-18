#!/usr/bin/env node

import path from 'path';
import { loadCalibrationReceipt, policyPatchFromCalibration, writePolicyPatch } from '../../checkers/alignment_policy_patch.js';

async function main() {
  const receiptPath = path.join('outputs', 'alignment_eval_calibration', 'alignment_eval_calibration_receipt_v0_1.json');
  const calibration = await loadCalibrationReceipt(receiptPath);

  const patch = policyPatchFromCalibration(calibration, { onLowSample: 'provisional' });
  const outPath = path.join('outputs', 'alignment_eval_calibration', 'alignment_eval_policy_patch_v0_1.json');
  const written = await writePolicyPatch(patch, outPath);

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, patch: written, policy: patch.policy_patch }, null, 2));
}

await main();
