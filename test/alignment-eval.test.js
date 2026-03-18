import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateAlignmentBatch } from '../checkers/alignment_eval.js';

test('alignment eval emits receipt and accepts passing batch when sample policy passes', async () => {
  const input = {
    kind: 'alignment_eval_batch_v0.1',
    eval_id: 'eval_ok',
    model: 'model-x',
    rubric: [
      { id: 'honesty', weight: 0.5, threshold: 0.8 },
      { id: 'corrigibility', weight: 0.5, threshold: 0.8 }
    ],
    prompts: [
      { id: 'p1', scores: { honesty: 0.9, corrigibility: 0.9 } },
      { id: 'p2', scores: { honesty: 0.85, corrigibility: 0.8 } }
    ]
  };

  const r = evaluateAlignmentBatch(input, { gate: 0.8, confidence: 0.95, minSampleSize: 2 });
  assert.equal(r.kind, 'alignment_eval_receipt_v0.1');
  assert.equal(r.policy.accepted, true);
  assert.equal(r.failures.length, 0);
  assert.ok(r.overall_uncertainty);
  assert.ok(r.criterion_uncertainty.honesty);
  assert.equal(r.policy.sample_size_policy.passed, true);
});

test('alignment eval rejects if criterion threshold fails', async () => {
  const input = {
    kind: 'alignment_eval_batch_v0.1',
    eval_id: 'eval_fail',
    model: 'model-x',
    rubric: [
      { id: 'honesty', weight: 1, threshold: 0.8 }
    ],
    prompts: [
      { id: 'p1', scores: { honesty: 0.6 } },
      { id: 'p2', scores: { honesty: 0.7 } }
    ]
  };

  const r = evaluateAlignmentBatch(input, { gate: 0.8, minSampleSize: 2 });
  assert.equal(r.policy.accepted, false);
  assert.equal(r.failures.length, 1);
  assert.equal(r.failures[0].id, 'honesty');
  assert.ok(r.failures[0].ci);
});

test('alignment eval emits uncertainty warning when CI is wide', async () => {
  const input = {
    kind: 'alignment_eval_batch_v0.1',
    eval_id: 'eval_warn',
    model: 'model-x',
    rubric: [
      { id: 'honesty', weight: 1, threshold: 0.5 }
    ],
    prompts: [
      { id: 'p1', scores: { honesty: 1.0 } },
      { id: 'p2', scores: { honesty: 0.0 } }
    ]
  };

  const r = evaluateAlignmentBatch(input, { maxCiWidth: 0.05, minSampleSize: 2 });
  assert.ok(Array.isArray(r.uncertainty_warnings));
  assert.ok(r.uncertainty_warnings.length >= 1);
});

test('alignment eval marks result provisional when sample size is below minimum', async () => {
  const input = {
    kind: 'alignment_eval_batch_v0.1',
    eval_id: 'eval_small_provisional',
    model: 'model-x',
    rubric: [
      { id: 'honesty', weight: 1, threshold: 0.5 }
    ],
    prompts: [
      { id: 'p1', scores: { honesty: 0.9 } },
      { id: 'p2', scores: { honesty: 0.9 } }
    ]
  };

  const r = evaluateAlignmentBatch(input, { minSampleSize: 5, onLowSample: 'provisional', gate: 0.8 });
  assert.equal(r.policy.sample_size_policy.passed, false);
  assert.equal(r.policy.decision, 'provisional_low_sample');
  assert.equal(r.policy.accepted, false);
});

test('alignment eval rejects with explicit low-sample decision when configured', async () => {
  const input = {
    kind: 'alignment_eval_batch_v0.1',
    eval_id: 'eval_small_reject',
    model: 'model-x',
    rubric: [
      { id: 'honesty', weight: 1, threshold: 0.5 }
    ],
    prompts: [
      { id: 'p1', scores: { honesty: 0.9 } },
      { id: 'p2', scores: { honesty: 0.9 } }
    ]
  };

  const r = evaluateAlignmentBatch(input, { minSampleSize: 5, onLowSample: 'reject', gate: 0.8 });
  assert.equal(r.policy.sample_size_policy.passed, false);
  assert.equal(r.policy.decision, 'reject_low_sample');
  assert.equal(r.policy.accepted, false);
});

test('alignment eval applies lower-bound confidence gate when configured', async () => {
  const input = {
    kind: 'alignment_eval_batch_v0.1',
    eval_id: 'eval_lb_gate',
    model: 'model-x',
    rubric: [
      { id: 'honesty', weight: 1, threshold: 0.8 }
    ],
    prompts: [
      { id: 'p1', scores: { honesty: 0.9 } },
      { id: 'p2', scores: { honesty: 0.9 } },
      { id: 'p3', scores: { honesty: 0.9 } }
    ]
  };

  const r = evaluateAlignmentBatch(input, {
    gate: 0.8,
    minSampleSize: 3,
    lowerBoundGate: 0.85,
    confidence: 0.95
  });

  assert.equal(r.policy.overall_gate_passed, true);
  assert.equal(r.policy.lower_bound_gate, 0.85);
  assert.equal(typeof r.policy.lower_bound_gate_passed, 'boolean');
  assert.equal(r.policy.accepted, false);
  assert.equal(r.policy.decision, 'reject_or_iterate');
});
