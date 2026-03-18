import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

function sha256(x) {
  return createHash('sha256').update(String(x)).digest('hex');
}

function reqArray(v, name) {
  if (!Array.isArray(v) || v.length === 0) throw new Error(`Missing non-empty array: ${name}`);
  return v;
}

function reqString(v, name) {
  if (typeof v !== 'string' || v.trim().length === 0) throw new Error(`Missing required string: ${name}`);
  return v;
}

function reqNumber(v, name) {
  if (typeof v !== 'number' || Number.isNaN(v)) throw new Error(`Missing required number: ${name}`);
  return v;
}

function clampScore(v) {
  return Math.max(1, Math.min(5, Number(v)));
}

function normalizedCriteria(criteria) {
  const weightSum = criteria.reduce((a, c) => a + reqNumber(c.weight, `criteria.${c.id}.weight`), 0);
  if (weightSum <= 0) throw new Error('Sum of criteria weights must be > 0');

  return criteria.map((c) => ({
    id: reqString(c.id, 'criteria[].id'),
    label: reqString(c.label, 'criteria[].label'),
    weight: c.weight,
    normalizedWeight: c.weight / weightSum
  }));
}

function xorshift32(seed) {
  let x = (seed | 0) || 123456789;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) / 4294967296);
  };
}

export function rankStrategies(input, options = {}) {
  const scaleMax = options.scaleMax ?? 5;

  const criteria = reqArray(input?.criteria, 'criteria');
  const alternatives = reqArray(input?.alternatives, 'alternatives');

  const nCriteria = normalizedCriteria(criteria);

  const ranked = alternatives.map((alt) => {
    const id = reqString(alt.id, 'alternatives[].id');
    const name = reqString(alt.name, `alternatives.${id}.name`);
    const scores = alt.scores && typeof alt.scores === 'object' ? alt.scores : null;
    if (!scores) throw new Error(`Missing scores object for alternative: ${id}`);

    let weighted = 0;
    const contributions = [];

    for (const c of nCriteria) {
      if (!(c.id in scores)) throw new Error(`Alternative ${id} missing score for criterion ${c.id}`);
      const raw = clampScore(scores[c.id]);
      const contribution = raw * c.normalizedWeight;
      weighted += contribution;
      contributions.push({ criterion: c.id, raw, weight: c.normalizedWeight, contribution });
    }

    const normalized01 = weighted / scaleMax;

    return {
      id,
      name,
      weighted_score: Number(weighted.toFixed(6)),
      normalized_score_0_1: Number(normalized01.toFixed(6)),
      contributions,
      rationale: alt.rationale || null,
      risks: Array.isArray(alt.risks) ? alt.risks : []
    };
  }).sort((a, b) => b.weighted_score - a.weighted_score);

  const top = ranked[0];
  return {
    method: 'weighted_sum_v0.1',
    generated_at: new Date().toISOString(),
    criteria: nCriteria,
    ranking: ranked.map((r, i) => ({ rank: i + 1, ...r })),
    recommendation: {
      id: top.id,
      name: top.name,
      score: top.weighted_score,
      confidence_note: 'Ranking is only as good as scores/weights; update iteratively with new evidence.'
    }
  };
}

export function sensitivityAnalysis(input, options = {}) {
  const deltaPct = options.deltaPct ?? 0.2;
  const base = rankStrategies(input, options);
  const criteria = reqArray(input?.criteria, 'criteria');

  const perCriterion = [];
  const topCounts = new Map();
  const pushTop = (id) => topCounts.set(id, (topCounts.get(id) || 0) + 1);

  const baselineTop = base.recommendation.id;
  pushTop(baselineTop);
  let runs = 1;

  for (const c of criteria) {
    const low = JSON.parse(JSON.stringify(input));
    const high = JSON.parse(JSON.stringify(input));

    const lowC = low.criteria.find((x) => x.id === c.id);
    const highC = high.criteria.find((x) => x.id === c.id);

    lowC.weight = Math.max(1e-6, lowC.weight * (1 - deltaPct));
    highC.weight = Math.max(1e-6, highC.weight * (1 + deltaPct));

    const lowRes = rankStrategies(low, options);
    const highRes = rankStrategies(high, options);

    pushTop(lowRes.recommendation.id);
    pushTop(highRes.recommendation.id);
    runs += 2;

    perCriterion.push({
      criterion: c.id,
      low_weight_top: lowRes.recommendation.id,
      high_weight_top: highRes.recommendation.id,
      stable_top: lowRes.recommendation.id === baselineTop && highRes.recommendation.id === baselineTop,
      causes_flip: lowRes.recommendation.id !== baselineTop || highRes.recommendation.id !== baselineTop
    });
  }

  const top_stability = {};
  for (const [id, n] of topCounts.entries()) {
    top_stability[id] = Number((n / runs).toFixed(6));
  }

  const flip_criteria = perCriterion
    .filter((x) => x.causes_flip)
    .map((x) => x.criterion);

  return {
    method: 'one_at_a_time_weight_perturbation_v0.1',
    generated_at: new Date().toISOString(),
    baseline_top: baselineTop,
    delta_pct: deltaPct,
    total_runs: runs,
    top_stability,
    per_criterion: perCriterion,
    flip_diagnostics: {
      flipped_criteria_count: flip_criteria.length,
      flipped_criteria: flip_criteria
    }
  };
}

export function monteCarloSensitivity(input, options = {}) {
  const deltaPct = options.deltaPct ?? 0.2;
  const trials = options.trials ?? 200;
  const seed = options.seed ?? 20260318;

  const criteria = reqArray(input?.criteria, 'criteria');
  const base = rankStrategies(input, options);
  const baselineTop = base.recommendation.id;
  const rand = xorshift32(seed);

  const topCounts = new Map();
  const pushTop = (id) => topCounts.set(id, (topCounts.get(id) || 0) + 1);

  const criterionShiftTotals = new Map();
  for (const c of criteria) criterionShiftTotals.set(c.id, 0);

  let baselineFlips = 0;

  pushTop(baselineTop);

  for (let i = 0; i < trials; i += 1) {
    const probe = JSON.parse(JSON.stringify(input));

    for (const c of probe.criteria) {
      const u = rand();
      const factor = 1 + ((u * 2 - 1) * deltaPct);
      c.weight = Math.max(1e-6, c.weight * factor);

      const original = input.criteria.find((x) => x.id === c.id)?.weight ?? 0;
      const absShift = Math.abs(c.weight - original);
      criterionShiftTotals.set(c.id, (criterionShiftTotals.get(c.id) || 0) + absShift);
    }

    const res = rankStrategies(probe, options);
    pushTop(res.recommendation.id);
    if (res.recommendation.id !== baselineTop) baselineFlips += 1;
  }

  const totalRuns = trials + 1;
  const top_stability = {};
  for (const [id, n] of topCounts.entries()) {
    top_stability[id] = Number((n / totalRuns).toFixed(6));
  }

  const stability_sorted = Object.entries(top_stability)
    .map(([id, stability]) => ({ id, stability }))
    .sort((a, b) => b.stability - a.stability);

  const dominant_instability_factors = Array.from(criterionShiftTotals.entries())
    .map(([criterion, total_abs_shift]) => ({ criterion, total_abs_shift: Number(total_abs_shift.toFixed(6)) }))
    .sort((a, b) => b.total_abs_shift - a.total_abs_shift);

  return {
    method: 'monte_carlo_weight_perturbation_v0.1',
    generated_at: new Date().toISOString(),
    baseline_top: baselineTop,
    delta_pct: deltaPct,
    trials,
    seed,
    total_runs: totalRuns,
    top_stability,
    stability_sorted,
    flip_diagnostics: {
      baseline_flips: baselineFlips,
      baseline_flip_rate: Number((baselineFlips / trials).toFixed(6)),
      dominant_instability_factors
    }
  };
}

export function decisionPolicy(result, sensitivity = null, monteCarlo = null, options = {}) {
  const threshold = options.stabilityThreshold ?? 0.8;
  const topId = result?.recommendation?.id;

  const oaat = sensitivity?.top_stability?.[topId];
  const mc = monteCarlo?.top_stability?.[topId];

  const hasOaat = typeof oaat === 'number';
  const hasMc = typeof mc === 'number';

  const passOaat = hasOaat ? oaat >= threshold : false;
  const passMc = hasMc ? mc >= threshold : false;

  const accept = passOaat && passMc;

  const failure_diagnostics = accept ? null : {
    oaat_failure: hasOaat ? oaat < threshold : true,
    mc_failure: hasMc ? mc < threshold : true,
    oaat_flip_criteria: sensitivity?.flip_diagnostics?.flipped_criteria || [],
    mc_baseline_flip_rate: monteCarlo?.flip_diagnostics?.baseline_flip_rate ?? null,
    mc_dominant_instability_factors: monteCarlo?.flip_diagnostics?.dominant_instability_factors || []
  };

  return {
    method: 'stability_threshold_gate_v0.1',
    threshold,
    top_id: topId,
    oaat_top_stability: hasOaat ? oaat : null,
    mc_top_stability: hasMc ? mc : null,
    accepted: accept,
    decision: accept ? 'accept_top_recommendation' : 'insufficient_robustness',
    note: accept
      ? 'Top recommendation passes robustness threshold across both analyses.'
      : 'Top recommendation did not pass robustness threshold on one or more analyses.',
    failure_diagnostics
  };
}

export async function rankStrategiesFromFile(inputPath, options = {}) {
  const full = path.resolve(process.cwd(), inputPath);
  const raw = await fs.readFile(full, 'utf-8');
  const json = JSON.parse(raw);
  return rankStrategies(json, options);
}

export async function writeRankingReceipt(result, outputPath, sourceInput, sensitivity = null, monteCarlo = null, policy = null) {
  const receipt = {
    kind: 'strategy_ranking_receipt_v0.1',
    generated_at: new Date().toISOString(),
    source_hash: sha256(JSON.stringify(sourceInput)),
    result,
    sensitivity,
    monte_carlo_sensitivity: monteCarlo,
    decision_policy: policy
  };

  const full = path.resolve(process.cwd(), outputPath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(receipt, null, 2), 'utf-8');
  return full;
}
