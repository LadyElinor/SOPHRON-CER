/**
 * Activation-delta drift proxy experiment harness.
 *
 * Goal: prove the activation-delta + linear probe concept end-to-end without
 * needing production-model activations.
 *
 * Inputs:
 *  - Either generate synthetic delta vectors (default)
 *  - Or load JSONL where each line is: { before:number[], after:number[], y:0|1 }
 *
 * Outputs:
 *  - Trained probe weights/bias
 *  - Basic metrics (accuracy at threshold, ROC AUC)
 */

import fs from 'fs/promises';
import { ActivationDriftDetector, trainLogRegProbe } from '../detectors/activation-drift-detector.js';

export async function loadJsonlPairs(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const rows = [];

  for (const line of lines) {
    const obj = JSON.parse(line);

    // Accept any of:
    //  - { before:number[], after:number[], y:0|1 }
    //  - { delta:number[], y:0|1 }
    //  - { delta:number[], label:0|1 }
    const y = (obj.y ?? obj.label);
    if (y !== 0 && y !== 1) throw new Error('JSONL row missing y/label (0|1)');

    if (Array.isArray(obj.delta)) {
      rows.push({ delta: obj.delta, y, meta: obj.meta ?? null });
      continue;
    }

    if (!Array.isArray(obj.before) || !Array.isArray(obj.after)) {
      throw new Error('JSONL row missing before/after or delta');
    }

    rows.push({ before: obj.before, after: obj.after, y, meta: obj.meta ?? null });
  }

  return rows;
}

export function makeSyntheticPairs({ n = 500, dim = 32, sep = 2.0, noise = 0.25 } = {}) {
  const pairs = [];
  for (let i = 0; i < n; i++) {
    // class 0: small deltas
    const before0 = new Array(dim).fill(0).map(() => randn() * noise);
    const after0 = before0.map((b) => b + randn() * noise);
    pairs.push({ before: before0, after: after0, y: 0 });

    // class 1: shifted deltas
    const before1 = new Array(dim).fill(0).map(() => randn() * noise);
    const after1 = before1.map((b) => b + sep + randn() * noise);
    pairs.push({ before: before1, after: after1, y: 1 });
  }
  return pairs;
}

export function trainAndEval({ pairs, steps = 200, lr = 0.2, l2 = 0, threshold = 0.5, config, logger }) {
  const det = new ActivationDriftDetector(config, logger);

  // Convert to delta vectors for training.
  const data = pairs.map((row) => {
    const x = row.delta ? row.delta : det.computeDelta(row.before, row.after);
    return { x, y: row.y };
  });
  const probe = trainLogRegProbe(data, { steps, lr, l2 });

  // Score all points.
  const scored = pairs.map((row) => {
    const delta = row.delta ? row.delta : det.computeDelta(row.before, row.after);
    const drift = det.scoreDelta(delta, probe, threshold);
    return { y: row.y, p: drift.probability };
  });

  const auc = rocAuc(scored);
  const acc = accuracyAtThreshold(scored, threshold);

  return {
    probe,
    metrics: {
      n: pairs.length,
      threshold,
      accuracy: acc,
      rocAuc: auc
    }
  };
}

function accuracyAtThreshold(scored, thr) {
  let correct = 0;
  for (const { y, p } of scored) {
    const pred = p >= thr ? 1 : 0;
    if (pred === y) correct++;
  }
  return correct / scored.length;
}

/**
 * ROC AUC for binary labels given scores p.
 * Uses the rank-sum / Mann–Whitney U equivalence.
 * @param {Array<{y:0|1, p:number}>} scored
 */
function rocAuc(scored) {
  const sorted = [...scored].sort((a, b) => a.p - b.p);

  let nPos = 0;
  let nNeg = 0;
  for (const s of sorted) {
    if (s.y === 1) nPos++;
    else nNeg++;
  }
  if (nPos === 0 || nNeg === 0) return null;

  // Handle ties by average ranks.
  let rank = 1;
  let sumRanksPos = 0;
  for (let i = 0; i < sorted.length; ) {
    let j = i + 1;
    while (j < sorted.length && sorted[j].p === sorted[i].p) j++;

    const count = j - i;
    const avgRank = (rank + (rank + count - 1)) / 2;

    for (let k = i; k < j; k++) {
      if (sorted[k].y === 1) sumRanksPos += avgRank;
    }

    rank += count;
    i = j;
  }

  const uPos = sumRanksPos - (nPos * (nPos + 1)) / 2;
  return uPos / (nPos * nNeg);
}

// Box–Muller normal RNG (deterministic seeding is out-of-scope here)
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
