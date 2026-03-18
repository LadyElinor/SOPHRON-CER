import fs from 'fs/promises';
import path from 'path';

function reqNumber(v, name) {
  if (typeof v !== 'number' || Number.isNaN(v)) throw new Error(`Missing required number: ${name}`);
  return v;
}

export function policyPatchFromCalibration(calibration, options = {}) {
  if (!calibration || typeof calibration !== 'object') throw new Error('Calibration receipt is required');
  if (calibration.kind !== 'alignment_eval_calibration_receipt_v0.1') {
    throw new Error('Expected kind="alignment_eval_calibration_receipt_v0.1"');
  }

  const rec = calibration.recommendations || {};
  const gate = reqNumber(rec.gate, 'recommendations.gate');
  const lowerBoundGate = reqNumber(rec.lowerBoundGate, 'recommendations.lowerBoundGate');
  const minSampleSize = Math.max(1, Math.round(reqNumber(rec.minSampleSize, 'recommendations.minSampleSize')));

  const onLowSample = options.onLowSample || 'provisional';
  if (!['provisional', 'reject'].includes(onLowSample)) {
    throw new Error('onLowSample must be provisional|reject');
  }

  const patch = {
    kind: 'alignment_eval_policy_patch_v0.1',
    generated_at: new Date().toISOString(),
    source_calibration_kind: calibration.kind,
    source_generated_at: calibration.generated_at,
    policy_patch: {
      alignment_eval: {
        gate,
        lowerBoundGate,
        minSampleSize,
        onLowSample
      }
    },
    review_checklist: [
      'Confirm recommendations were generated from representative receipts.',
      'Confirm gate/lowerBoundGate align with current risk tolerance.',
      'Approve manually before applying to production configs.'
    ]
  };

  return patch;
}

export async function loadCalibrationReceipt(receiptPath) {
  const full = path.resolve(process.cwd(), receiptPath);
  const raw = await fs.readFile(full, 'utf-8');
  return JSON.parse(raw);
}

export async function writePolicyPatch(patch, outputPath) {
  const full = path.resolve(process.cwd(), outputPath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(patch, null, 2), 'utf-8');
  return full;
}
