#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';

import { loadReceiptsFromDir, calibrateFromReceipts, writeCalibrationReceipt } from '../../checkers/alignment_calibration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const receiptsDir = path.join(__dirname, 'receipts');
  const receipts = await loadReceiptsFromDir(receiptsDir);
  const result = calibrateFromReceipts(receipts, { minSampleSizeFloor: 20 });

  const outPath = path.join('outputs', 'alignment_eval_calibration', 'alignment_eval_calibration_receipt_v0_1.json');
  const written = await writeCalibrationReceipt(result, outPath);

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, recommendations: result.recommendations, receipt: written }, null, 2));
}

await main();
