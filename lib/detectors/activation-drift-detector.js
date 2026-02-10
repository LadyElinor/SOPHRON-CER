/**
 * Activation-delta drift detector (proxy/open-model mode).
 *
 * Inspired by: arXiv:2406.00799 “Get my drift? Catching LLM Task Drift with Activation Deltas”.
 *
 * This module is intentionally model-agnostic:
 *  - You provide two activation vectors (before/after) from any model/layer.
 *  - It computes a delta vector and scores it with a lightweight linear probe.
 *
 * SOPHRON-CER integration goal:
 *  - Shadow/experimental mode: produce an auxiliary drift score that can be compared
 *    against output-only drift signals.
 *  - Receipted/provenanced: record model id, layer, probe version, and thresholds.
 */

/**
 * @typedef {Object} LinearProbe
 * @property {string} id - Probe identifier/version (e.g., "tasktracker-logreg-v0")
 * @property {number[]} weights - Weight vector w
 * @property {number} bias - Bias term b
 */

/**
 * @typedef {Object} DriftScore
 * @property {number} score - Raw linear score (logit)
 * @property {number} probability - Sigmoid(score)
 * @property {boolean} flagged - probability >= threshold
 * @property {number} threshold - threshold used
 */

export class ActivationDriftDetector {
  /**
   * @param {Object} config
   * @param {Object} logger
   */
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;

    const cfg = config?.analysis?.activationDrift || {};
    this.enabled = !!cfg.enabled;
    this.threshold = Number.isFinite(cfg.threshold) ? cfg.threshold : 0.5;
  }

  /**
   * Compute delta = after - before.
   * @param {ArrayLike<number>} before
   * @param {ArrayLike<number>} after
   * @returns {number[]}
   */
  computeDelta(before, after) {
    if (!before || !after) throw new Error('computeDelta: missing vectors');
    if (before.length !== after.length) {
      throw new Error(`computeDelta: length mismatch before=${before.length} after=${after.length}`);
    }

    const delta = new Array(before.length);
    for (let i = 0; i < before.length; i++) {
      delta[i] = after[i] - before[i];
    }
    return delta;
  }

  /**
   * L2 norm of a vector.
   * @param {ArrayLike<number>} v
   * @returns {number}
   */
  l2Norm(v) {
    let s = 0;
    for (let i = 0; i < v.length; i++) {
      const x = v[i];
      s += x * x;
    }
    return Math.sqrt(s);
  }

  /**
   * Score a delta vector with a linear probe.
   * @param {ArrayLike<number>} delta
   * @param {LinearProbe} probe
   * @param {number} [threshold=this.threshold]
   * @returns {DriftScore}
   */
  scoreDelta(delta, probe, threshold = this.threshold) {
    if (!probe || !Array.isArray(probe.weights)) throw new Error('scoreDelta: invalid probe');
    if (delta.length !== probe.weights.length) {
      throw new Error(`scoreDelta: length mismatch delta=${delta.length} w=${probe.weights.length}`);
    }

    let score = probe.bias || 0;
    for (let i = 0; i < delta.length; i++) {
      score += probe.weights[i] * delta[i];
    }

    const probability = this.sigmoid(score);
    const flagged = probability >= threshold;

    return { score, probability, flagged, threshold };
  }

  /**
   * Convenience: compute delta + score.
   * @param {ArrayLike<number>} before
   * @param {ArrayLike<number>} after
   * @param {LinearProbe} probe
   * @param {number} [threshold=this.threshold]
   * @returns {{ delta: number[], deltaNorm: number, drift: DriftScore }}
   */
  detect(before, after, probe, threshold = this.threshold) {
    const delta = this.computeDelta(before, after);
    const deltaNorm = this.l2Norm(delta);
    const drift = this.scoreDelta(delta, probe, threshold);
    return { delta, deltaNorm, drift };
  }

  sigmoid(x) {
    // numerically-stable-ish sigmoid
    if (x >= 0) {
      const z = Math.exp(-x);
      return 1 / (1 + z);
    }
    const z = Math.exp(x);
    return z / (1 + z);
  }
}

/**
 * Minimal, deterministic “probe training” utility.
 *
 * NOTE: This is a simple logistic regression trainer (batch GD) intended for small
 * proxy experiments and fixtures. For TaskTracker-scale training, prefer using
 * their provided training code and export probe weights into JSON.
 *
 * @param {Array<{x:number[], y:0|1}>} data
 * @param {Object} opts
 * @param {number} [opts.steps=200]
 * @param {number} [opts.lr=0.1]
 * @param {number} [opts.l2=0]
 * @returns {LinearProbe}
 */
export function trainLogRegProbe(data, opts = {}) {
  const steps = Number.isFinite(opts.steps) ? opts.steps : 200;
  const lr = Number.isFinite(opts.lr) ? opts.lr : 0.1;
  const l2 = Number.isFinite(opts.l2) ? opts.l2 : 0;

  if (!Array.isArray(data) || data.length === 0) throw new Error('trainLogRegProbe: empty data');
  const d = data[0].x.length;

  const w = new Array(d).fill(0);
  let b = 0;

  const sigmoid = (x) => (x >= 0 ? 1 / (1 + Math.exp(-x)) : (Math.exp(x) / (1 + Math.exp(x))));

  for (let step = 0; step < steps; step++) {
    const gradW = new Array(d).fill(0);
    let gradB = 0;

    for (const { x, y } of data) {
      if (x.length !== d) throw new Error('trainLogRegProbe: inconsistent dimensionality');

      let z = b;
      for (let i = 0; i < d; i++) z += w[i] * x[i];
      const p = sigmoid(z);
      const err = (p - y); // derivative of log-loss

      for (let i = 0; i < d; i++) gradW[i] += err * x[i];
      gradB += err;
    }

    const n = data.length;
    for (let i = 0; i < d; i++) {
      const reg = l2 > 0 ? l2 * w[i] : 0;
      w[i] -= lr * ((gradW[i] / n) + reg);
    }
    b -= lr * (gradB / n);
  }

  return { id: 'logreg-gd-v0', weights: w, bias: b };
}

/**
 * Serialize/deserialize probes for receipts.
 */
export function probeToJson(probe) {
  return JSON.stringify(probe, null, 2);
}

export function probeFromJson(json) {
  const obj = (typeof json === 'string') ? JSON.parse(json) : json;
  if (!obj || !Array.isArray(obj.weights)) throw new Error('probeFromJson: invalid probe JSON');
  return {
    id: obj.id || 'unknown-probe',
    weights: obj.weights,
    bias: Number.isFinite(obj.bias) ? obj.bias : 0
  };
}
