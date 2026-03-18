import test from 'node:test';
import assert from 'node:assert/strict';

import { rankStrategies, sensitivityAnalysis, monteCarloSensitivity, decisionPolicy } from '../checkers/strategy_ranker.js';

test('strategy ranker returns deterministic top recommendation for baseline sample', async () => {
  const input = {
    criteria: [
      { id: 'benefit', label: 'Benefit', weight: 0.5 },
      { id: 'safety', label: 'Safety', weight: 0.5 }
    ],
    alternatives: [
      { id: 'a', name: 'A', scores: { benefit: 5, safety: 5 } },
      { id: 'b', name: 'B', scores: { benefit: 4, safety: 3 } }
    ]
  };

  const result = rankStrategies(input);
  assert.equal(result.ranking[0].id, 'a');
  assert.equal(result.recommendation.id, 'a');
  assert.ok(result.ranking[0].weighted_score >= result.ranking[1].weighted_score);
});

test('strategy ranker fails on missing criterion score', async () => {
  const input = {
    criteria: [{ id: 'x', label: 'X', weight: 1 }],
    alternatives: [{ id: 'a', name: 'A', scores: {} }]
  };

  assert.throws(() => rankStrategies(input), /missing score/i);
});

test('sensitivity analysis returns baseline stability summary + flip diagnostics', async () => {
  const input = {
    criteria: [
      { id: 'benefit', label: 'Benefit', weight: 0.5 },
      { id: 'safety', label: 'Safety', weight: 0.5 }
    ],
    alternatives: [
      { id: 'a', name: 'A', scores: { benefit: 5, safety: 5 } },
      { id: 'b', name: 'B', scores: { benefit: 4, safety: 3 } }
    ]
  };

  const s = sensitivityAnalysis(input, { deltaPct: 0.2 });
  assert.equal(s.baseline_top, 'a');
  assert.equal(typeof s.top_stability.a, 'number');
  assert.ok(s.total_runs >= 3);
  assert.equal(s.per_criterion.length, 2);
  assert.equal(typeof s.flip_diagnostics.flipped_criteria_count, 'number');
});

test('monte carlo sensitivity is deterministic with fixed seed + has diagnostics', async () => {
  const input = {
    criteria: [
      { id: 'benefit', label: 'Benefit', weight: 0.6 },
      { id: 'safety', label: 'Safety', weight: 0.4 }
    ],
    alternatives: [
      { id: 'a', name: 'A', scores: { benefit: 5, safety: 4 } },
      { id: 'b', name: 'B', scores: { benefit: 4, safety: 5 } }
    ]
  };

  const r1 = monteCarloSensitivity(input, { deltaPct: 0.2, trials: 50, seed: 12345 });
  const r2 = monteCarloSensitivity(input, { deltaPct: 0.2, trials: 50, seed: 12345 });

  assert.deepEqual(r1.top_stability, r2.top_stability);
  assert.equal(r1.total_runs, 51);
  assert.equal(typeof r1.stability_sorted[0].id, 'string');
  assert.equal(typeof r1.flip_diagnostics.baseline_flip_rate, 'number');
  assert.ok(Array.isArray(r1.flip_diagnostics.dominant_instability_factors));
});

test('decision policy gates recommendation by stability threshold + includes failure diagnostics', async () => {
  const result = {
    recommendation: { id: 'topA' }
  };

  const sensitivity = {
    top_stability: { topA: 0.9 },
    flip_diagnostics: { flipped_criteria: [] }
  };
  const monte = {
    top_stability: { topA: 0.85 },
    flip_diagnostics: { baseline_flip_rate: 0, dominant_instability_factors: [] }
  };

  const pass = decisionPolicy(result, sensitivity, monte, { stabilityThreshold: 0.8 });
  assert.equal(pass.accepted, true);
  assert.equal(pass.decision, 'accept_top_recommendation');
  assert.equal(pass.failure_diagnostics, null);

  const fail = decisionPolicy(
    result,
    { top_stability: { topA: 0.7 }, flip_diagnostics: { flipped_criteria: ['benefit'] } },
    { top_stability: { topA: 0.6 }, flip_diagnostics: { baseline_flip_rate: 0.4, dominant_instability_factors: [{ criterion: 'safety', total_abs_shift: 10 }] } },
    { stabilityThreshold: 0.8 }
  );

  assert.equal(fail.accepted, false);
  assert.equal(fail.decision, 'insufficient_robustness');
  assert.ok(Array.isArray(fail.failure_diagnostics.oaat_flip_criteria));
  assert.equal(typeof fail.failure_diagnostics.mc_baseline_flip_rate, 'number');
});
