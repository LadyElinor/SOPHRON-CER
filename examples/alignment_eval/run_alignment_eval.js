#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';

import { evaluateAlignmentBatchFromFile, writeAlignmentReceipt } from '../../checkers/alignment_eval.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const inputPath = path.join(__dirname, 'alignment_eval_batch_v0_1.json');
  const receipt = await evaluateAlignmentBatchFromFile(inputPath, { gate: 0.8 });

  const outPath = path.join('outputs', 'alignment_eval', 'alignment_eval_receipt_v0_1.json');
  const written = await writeAlignmentReceipt(receipt, outPath);

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, decision: receipt.policy, receipt: written }, null, 2));
}

await main();
