#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

import { rankStrategiesFromFile, writeRankingReceipt, sensitivityAnalysis, monteCarloSensitivity, decisionPolicy } from '../../checkers/strategy_ranker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const inputPath = path.join(__dirname, 'superintelligence_alignment_options_v0_1.json');
  const raw = JSON.parse(await fs.readFile(inputPath, 'utf-8'));

  const result = await rankStrategiesFromFile(inputPath);
  const sensitivity = sensitivityAnalysis(raw, { deltaPct: 0.2 });
  const mc = monteCarloSensitivity(raw, { deltaPct: 0.2, trials: 300, seed: 20260318 });
  const policy = decisionPolicy(result, sensitivity, mc, { stabilityThreshold: 0.8 });

  const outPath = path.join('outputs', 'strategy_prioritization', 'strategy_ranking_receipt_v0_1.json');
  const receiptPath = await writeRankingReceipt(result, outPath, raw, sensitivity, mc, policy);

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, top: result.recommendation, sensitivity, monteCarlo: mc, policy, receipt: receiptPath }, null, 2));
}

await main();
