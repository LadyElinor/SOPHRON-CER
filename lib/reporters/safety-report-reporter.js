import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function stableJson(obj) {
  // Best-effort deterministic JSON for hashing/identity.
  // Handles plain objects/arrays; not intended for cyclic structures.
  const normalize = (x) => {
    if (x === null || x === undefined) return x;
    if (Array.isArray(x)) return x.map(normalize);
    if (typeof x === 'object') {
      const out = {};
      for (const k of Object.keys(x).sort()) out[k] = normalize(x[k]);
      return out;
    }
    return x;
  };
  return JSON.stringify(normalize(obj));
}

function ciWidth(ci) {
  if (!ci) return Infinity;
  const lo = typeof ci.lower === 'number' ? ci.lower : -Infinity;
  const hi = typeof ci.upper === 'number' ? ci.upper : Infinity;
  return hi - lo;
}

export class SafetyReportReporter {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  requiredManifestFields() {
    return ['run_id', 'git_sha', 'package_version', 'config_hash', 'dependency_lock_hash', 'data_hash'];
  }

  assertManifest(manifest) {
    const missing = [];
    for (const f of this.requiredManifestFields()) {
      if (!manifest || !(f in manifest) || manifest[f] === null || manifest[f] === undefined || String(manifest[f]).trim() === '') {
        missing.push(f);
      }
    }

    if (missing.length > 0) {
      const msg = `Safety report manifest missing required fields: ${missing.join(', ')}`;
      if (this.config?.reporting?.safetyReport?.failOnMissingManifest ?? true) {
        throw new Error(msg);
      }
      this.logger?.warn({ missing }, msg);
    }
  }

  selectPrimarySignals(signals, maxPrimary) {
    // Deterministic risk-weighted top-k: higher prevalence and narrower CI rank higher.
    // score = prevalence / (ci_width + eps)
    const eps = 1e-9;
    const scored = signals.map(s => {
      const width = ciWidth(s.ci);
      const estimate = (typeof s.estimate === 'number') ? s.estimate : 0;
      const score = estimate / (width + eps);
      return { s, score };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Tie-breaker: signal_id lexicographic
      return String(a.s.signal_id).localeCompare(String(b.s.signal_id));
    });

    return scored.slice(0, maxPrimary).map(x => x.s);
  }

  makeSignal({ signalId, description, prevalenceObj }) {
    const estimate = prevalenceObj?.prevalence;
    const ci = {
      lower: prevalenceObj?.confidence?.lower ?? null,
      upper: prevalenceObj?.confidence?.upper ?? null,
      method: 'wilson'
    };

    const flags = [];
    if (estimate === null || estimate === undefined) flags.push('missing_estimate');
    if (typeof ci.lower === 'number' && typeof ci.upper === 'number') {
      if ((ci.upper - ci.lower) > (this.config?.reporting?.safetyReport?.wideCiThreshold ?? 0.20)) {
        flags.push('wide_ci');
      }
    }

    // v0.1: power and multiplicity are generally unknown in this pipeline.
    flags.push('power_unknown');
    flags.push('multiplicity_unknown');

    return {
      signal_id: signalId,
      description,
      estimate: (typeof estimate === 'number') ? estimate : null,
      ci,
      effect_size: { cohen_h: null, interpretation: null },
      tests: { p_value: null, p_adjusted: null, adjustment: 'none', m: null },
      stats_quality: {
        power_estimate: null,
        power_assumptions: null,
        multiplicity: { family: 'primary_signals', m: null, adjustment: 'none', p_adjusted: null },
        flags
      }
    };
  }

  assemble({ analysisResults, validationResults, metadata, piiSummary }) {
    const manifest = {
      run_id: metadata?.runId ?? metadata?.run_id,
      git_sha: metadata?.gitSha ?? metadata?.codeVersion,
      package_version: metadata?.packageVersion,
      config_hash: metadata?.configHash ? `sha256:${String(metadata.configHash)}` : null,
      dependency_lock_hash: metadata?.dependencyLockHash ? `sha256:${String(metadata.dependencyLockHash)}` : null,
      data_hash: metadata?.dataHash ? `sha256:${String(metadata.dataHash)}` : null
    };

    this.assertManifest(manifest);

    const sampleSize = analysisResults?.summary?.uniquePosts ?? null;

    // Sources: best-effort. In v0.1, default to moltx.
    const sources = [metadata?.source ?? 'moltx'];

    const timeWindow = { start: metadata?.timeWindow?.start ?? null, end: metadata?.timeWindow?.end ?? null };

    // Build candidate signals from overall prevalences
    const overallPrev = analysisResults?.overall?.prevalences ?? {};
    const candidates = [];
    for (const [feature, prev] of Object.entries(overallPrev)) {
      candidates.push(this.makeSignal({
        signalId: `overall.prevalence.${feature}`,
        description: `Overall prevalence of ${feature}`,
        prevalenceObj: prev
      }));
    }

    const maxPrimary = this.config?.reporting?.safetyReport?.maxPrimarySignals ?? 10;
    const primarySignals = this.selectPrimarySignals(candidates, maxPrimary);

    const report = {
      report_id: crypto.randomUUID(),
      spec_version: '0.1',
      generated_at: new Date().toISOString(),
      manifest,
      data_summary: {
        sample_size: sampleSize,
        effective_n: metadata?.effectiveN ?? null,
        time_window: timeWindow,
        sources
      },
      invariants: {
        all_passed: !!validationResults?.valid,
        violations: validationResults?.violations ?? []
      },
      primary_signal_selection: {
        max_primary: maxPrimary,
        method: 'risk_weighted_topk',
        deterministic: true,
        inputs: ['prevalence', 'ci_width'],
        seed: null,
        notes: 'Deterministic given the same inputs'
      },
      findings: {
        primary_signals: primarySignals,
        secondary_signals: []
      },
      privacy: {
        pii_redactions: piiSummary?.redactions ?? 0,
        k_anonymity_threshold: this.config?.privacy?.kAnonymity ?? null
      },
      assessment: {
        overall: { category: 'unknown', score: null, components: [] },
        guidance: 'See findings. Humility flags are embedded per-signal (stats_quality.flags).',
        alerts_triggered: []
      }
    };

    return report;
  }

  async writeJson(dir, report) {
    const fp = path.join(dir, 'safety_report.json');
    await fs.writeFile(fp, JSON.stringify(report, null, 2), 'utf-8');
    this.logger?.info({ filepath: fp }, 'Wrote Safety Telemetry Report (JSON)');
    return fp;
  }

  async writeMarkdown(dir, report) {
    const fp = path.join(dir, 'safety_report.md');
    const lines = [];
    lines.push(`# Safety Telemetry Report v${report.spec_version}`);
    lines.push('');
    lines.push('- Run: `' + report.manifest.run_id + '`');
    lines.push('- Generated: ' + report.generated_at);
    lines.push('- Git: `' + report.manifest.git_sha + '`');
    lines.push('- Config hash: `' + report.manifest.config_hash + '`');
    lines.push('- Data hash: `' + report.manifest.data_hash + '`');
    lines.push('');
    lines.push(`## Invariants: ${report.invariants.all_passed ? 'PASS' : 'FAIL'}`);
    if (!report.invariants.all_passed) {
      lines.push('');
      for (const v of (report.invariants.violations || [])) {
        lines.push(`- **${v.invariant}**: ${v.message}`);
      }
    }
    lines.push('');
    lines.push('## Primary signals');
    for (const s of (report.findings.primary_signals || [])) {
      const est = (s.estimate === null || s.estimate === undefined) ? 'null' : (s.estimate * 100).toFixed(2) + '%';
      const lo = (typeof s.ci?.lower === 'number') ? (s.ci.lower * 100).toFixed(2) + '%' : 'null';
      const hi = (typeof s.ci?.upper === 'number') ? (s.ci.upper * 100).toFixed(2) + '%' : 'null';
      lines.push(`- **${s.signal_id}**: ${est} (CI ${lo}–${hi}, ${s.ci?.method || 'n/a'})`);
      if (s.stats_quality?.flags?.length) {
        lines.push(`  - flags: ${s.stats_quality.flags.join(', ')}`);
      }
    }

    await fs.writeFile(fp, lines.join('\n') + '\n', 'utf-8');
    this.logger?.info({ filepath: fp }, 'Wrote Safety Telemetry Report (Markdown)');
    return fp;
  }

  hashDependencyLock(lockText) {
    return sha256Hex(lockText);
  }

  computeDataHash(posts) {
    // Hash of sorted post IDs (and timestamps if present) for run identity.
    const rows = (posts || []).map(p => ({ id: p.id ?? null, timestamp: p.timestamp ?? null }));
    rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return sha256Hex(stableJson(rows));
  }
}
