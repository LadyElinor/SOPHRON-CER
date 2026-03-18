import fs from 'fs/promises';
import path from 'path';

function reqArray(v, name) {
  if (!Array.isArray(v) || v.length === 0) throw new Error(`Missing non-empty array: ${name}`);
  return v;
}

export function calibrateFromReceipts(receipts, options = {}) {
  const rs = reqArray(receipts, 'receipts');
  const minN = options.minSampleSizeFloor ?? 20;

  const overallScores = rs.map((r) => Number(r.overall_score)).filter((x) => Number.isFinite(x));
  const sampleSizes = rs.map((r) => Number(r.sample_size)).filter((x) => Number.isFinite(x));
  const accepted = rs.filter((r) => r?.policy?.accepted === true).length;

  if (!overallScores.length || !sampleSizes.length) {
    throw new Error('Receipts missing required overall_score/sample_size');
  }

  const sortedScores = [...overallScores].sort((a, b) => a - b);
  const idx = Math.floor(0.25 * (sortedScores.length - 1));
  const conservativeGate = Number(sortedScores[idx].toFixed(4));

  const medianSample = [...sampleSizes].sort((a, b) => a - b)[Math.floor(sampleSizes.length / 2)];
  const recommendedMinN = Math.max(minN, Math.round(medianSample));

  const avgLowerBound = Number((rs
    .map((r) => Number(r?.overall_uncertainty?.lower))
    .filter((x) => Number.isFinite(x))
    .reduce((a, b, _, arr) => a + b / arr.length, 0)).toFixed(4));

  return {
    kind: 'alignment_eval_calibration_receipt_v0.1',
    generated_at: new Date().toISOString(),
    input_count: rs.length,
    acceptance_rate: Number((accepted / rs.length).toFixed(4)),
    recommendations: {
      gate: conservativeGate,
      lowerBoundGate: avgLowerBound,
      minSampleSize: recommendedMinN
    },
    notes: [
      'Gate set to empirical lower quartile of historical overall_score.',
      'minSampleSize floored by configured minimum and median observed sample size.',
      'lowerBoundGate set from average observed CI lower bound.'
    ]
  };
}

export async function loadReceiptsFromDir(receiptsDir) {
  const full = path.resolve(process.cwd(), receiptsDir);
  const files = await fs.readdir(full);
  const out = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const raw = await fs.readFile(path.join(full, f), 'utf-8');
    const j = JSON.parse(raw);
    if (j?.kind === 'alignment_eval_receipt_v0.1') out.push(j);
  }
  return out;
}

export async function writeCalibrationReceipt(receipt, outputPath) {
  const full = path.resolve(process.cwd(), outputPath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(receipt, null, 2), 'utf-8');
  return full;
}
