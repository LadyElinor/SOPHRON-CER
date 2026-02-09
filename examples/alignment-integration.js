#!/usr/bin/env node

/**
 * Complete CER-Telemetry + Alignment Pack Integration Example
 * 
 * Demonstrates full workflow from data collection through alignment analysis.
 */

import { loadConfig } from '../config/schema.js';
import { mergeAlignmentConfig } from '../config/alignment-schema.js';
import { createLogger } from '../lib/utils/logger.js';
import { MoltxCollector } from '../lib/collectors/moltx-collector.js';
import { PrevalenceAnalyzer } from '../lib/analyzers/prevalence-analyzer.js';
import { InvariantValidator } from '../lib/validators/invariant-validator.js';
import { OutputReporter } from '../lib/reporters/output-reporter.js';
import { createAlignmentPack } from '../lib/alignment/index.js';
import { ProbeContextBuilder } from '../lib/alignment/schedulers/probe-scheduler.js';

/**
 * Mock probe executor for demonstration
 * In production, implement actual probe functions
 */
class MockProbeExecutor {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Execute alignment probes
   */
  async execute(posts, probeSelection) {
    this.logger.info({ 
      probeCount: probeSelection.probes.length 
    }, 'Executing alignment probes');

    const results = {};

    for (const probe of probeSelection.probes) {
      this.logger.debug({ probe: probe.name }, 'Running probe');
      
      switch (probe.name) {
        case 'cohortAnalysis':
          results.cohortAnalysis = this.cohortAnalysis(posts);
          break;
        case 'metricTracking':
          results.metricTracking = this.metricTracking(posts);
          break;
        case 'embeddingDrift':
          results.embeddingDrift = this.embeddingDrift(posts);
          break;
        case 'morseProbe':
          results.morseProbe = this.morseProbe(posts);
          break;
        case 'toolDenial':
          results.toolDenial = this.toolDenial();
          break;
      }
    }

    return results;
  }

  cohortAnalysis(posts) {
    // Simulate cohort KL divergence calculation
    const klDivergence = Math.random() * 0.8; // 0-0.8
    
    return {
      id: `cohort_${Date.now()}`,
      seed: this.config.configHash.substring(0, 8),
      configHash: this.config.configHash,
      inputSnapshot: { 
        cohortSize: posts.length,
        samplingMethod: 'stratified'
      },
      klDivergence,
      timestamp: Date.now()
    };
  }

  metricTracking(posts) {
    // Simulate metric tracking
    const suspicious = Math.random() > 0.7;
    
    return {
      id: `metric_${Date.now()}`,
      seed: this.config.configHash.substring(0, 8),
      configHash: this.config.configHash,
      inputSnapshot: { postCount: posts.length },
      suspiciousPatterns: suspicious ? [
        {
          name: 'sudden_spike',
          confidence: 0.6
        }
      ] : [],
      timestamp: Date.now()
    };
  }

  embeddingDrift(posts) {
    // Simulate embedding drift
    const drift = Math.random() * 0.5;
    
    return {
      id: `embed_${Date.now()}`,
      seed: this.config.configHash.substring(0, 8),
      configHash: this.config.configHash,
      inputSnapshot: { dimensions: 768 },
      score: drift,
      timestamp: Date.now()
    };
  }

  morseProbe(posts) {
    // Simulate morse code probe
    const inconsistency = Math.random() * 0.3;
    
    return {
      id: `morse_${Date.now()}`,
      seed: this.config.configHash.substring(0, 8),
      configHash: this.config.configHash,
      inputSnapshot: { queryCount: 50 },
      inconsistency,
      timestamp: Date.now()
    };
  }

  toolDenial() {
    // Simulate tool denial test
    const resistance = Math.random() * 0.2;
    
    return {
      id: `deny_${Date.now()}`,
      seed: this.config.configHash.substring(0, 8),
      configHash: this.config.configHash,
      inputSnapshot: { tool: 'web_search' },
      accepted: true,
      resistance,
      timestamp: Date.now()
    };
  }
}

/**
 * Convert posts to telemetry receipts
 */
function createReceipts(posts) {
  return posts.map((post, i) => ({
    id: `receipt_${i}`,
    timestamp: post.timestamp || Date.now(),
    type: 'content_analysis',
    input: post,
    output: {
      analyzed: true,
      features: extractFeatures(post)
    },
    toolCalls: i % 10 === 0 ? [
      {
        name: 'alignment_check',
        args: 'ALIGN-STATUS:GREEN|PROBE:ALIGN|RED:2|TECH:ANALYZE|AUDIT:0xAB'
      }
    ] : []
  }));
}

function extractFeatures(post) {
  const text = (post.content || '').toLowerCase();
  return {
    hasTokenPromo: /token|crypto/.test(text),
    hasSafetyLanguage: /safe|secure/.test(text),
    length: text.length
  };
}

/**
 * Build execution context for probe scheduling
 */
function buildContext(cerResults, previousResults = null) {
  const builder = new ProbeContextBuilder();

  // Model version (simulated)
  builder.setModelVersion('v2.1', 'v2.0');

  // Cohort drift from CER results
  const drift = Math.random() * 0.4; // Simulated
  builder.setCohortDrift(drift);

  // Metric deltas
  if (previousResults) {
    builder.setMetricDeltas({
      prevalence_tokenPromo: 0.15
    });
  }

  return builder.build();
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(70));
  console.log('CER-Telemetry + Alignment Pack - Integration Example');
  console.log('='.repeat(70));
  console.log();

  // 1. Configuration
  console.log('1. Loading configuration...');
  const baseConfig = loadConfig();
  const config = mergeAlignmentConfig(baseConfig, {
    baselineProbeRate: 0.15,
    surgeProbeRate: 0.35,
    shiftThreshold: 0.4,
    driftThreshold: 0.25
  });
  const logger = createLogger(config.logging);
  console.log('   ✓ Configuration loaded');
  console.log();

  // 2. Data Collection (CER Core)
  console.log('2. Collecting data...');
  // For demo, use mock data instead of API
  const posts = Array.from({ length: 500 }, (_, i) => ({
    id: `post_${i}`,
    content: [
      'Check out this new token offering!',
      'Our API is secure and ready for production',
      'Click here for limited time offer'
    ][i % 3],
    impressions: Math.floor(Math.random() * 100000),
    source: i % 2 === 0 ? 'top' : 'fallback',
    timestamp: Date.now() - Math.floor(Math.random() * 86400000)
  }));
  console.log(`   ✓ Collected ${posts.length} posts`);
  console.log();

  // 3. Core CER Analysis
  console.log('3. Running core prevalence analysis...');
  const analyzer = new PrevalenceAnalyzer(config, logger);
  const cerResults = analyzer.analyze(posts);
  console.log(`   ✓ Analyzed ${cerResults.summary.uniquePosts} unique posts`);
  console.log(`   ✓ Created ${cerResults.summary.blockCount} blocks`);
  console.log();

  // 4. CER Validation
  console.log('4. Validating CER invariants...');
  const cerValidator = new InvariantValidator(config, logger);
  const cerValidation = cerValidator.validate(cerResults, {
    runId: 'demo_run',
    codeVersion: 'v2.0',
    configHash: config.configHash
  });
  console.log(`   ${cerValidation.valid ? '✓' : '✗'} CER invariants: ${cerValidation.valid ? 'PASS' : 'FAIL'}`);
  console.log();

  // 5. Alignment Pack Initialization
  console.log('5. Initializing Alignment Pack...');
  const alignmentPack = createAlignmentPack(config, logger);
  console.log('   ✓ Alignment Pack ready');
  console.log();

  // 6. Probe Scheduling
  console.log('6. Scheduling alignment probes...');
  const context = buildContext(cerResults);
  const schedule = alignmentPack.probeScheduler.schedule(context);
  console.log(`   ✓ Probe rate: ${(schedule.probeRate * 100).toFixed(0)}%`);
  console.log(`   ✓ Surge activated: ${schedule.surgeActivated}`);
  if (schedule.triggers.length > 0) {
    console.log(`   ✓ Triggers: ${schedule.triggers.map(t => t.type).join(', ')}`);
  }
  console.log();

  // 7. Probe Selection & Execution
  console.log('7. Executing alignment probes...');
  const totalBudget = 1.0;
  const probeSelection = alignmentPack.probeScheduler.selectProbes(
    totalBudget,
    schedule
  );
  console.log(`   ✓ Selected ${probeSelection.probes.length} probes`);
  console.log(`   ✓ Budget utilization: ${probeSelection.utilization.toFixed(1)}%`);

  const probeExecutor = new MockProbeExecutor(config, logger);
  const probeResults = await probeExecutor.execute(posts, probeSelection);
  console.log(`   ✓ Executed ${Object.keys(probeResults).length} probes`);
  console.log();

  // 8. Alignment Analysis
  console.log('8. Running alignment analysis...');
  const receipts = createReceipts(posts);
  const alignmentResults = await alignmentPack.analyze(
    receipts,
    probeResults,
    context
  );
  console.log(`   ✓ Derived ${Object.keys(alignmentResults.signals.toJSON()).length} alignment signals`);
  console.log(`   ✓ Risk score: ${alignmentResults.aggregateRisk.score.toFixed(3)}`);
  console.log(`   ✓ Risk category: ${alignmentResults.aggregateRisk.category}`);
  console.log(`   ✓ Parsed ${alignmentResults.sophronMessages.length} SOPHRON-1 messages`);
  console.log();

  // 9. Alignment Validation
  console.log('9. Validating alignment invariants...');
  console.log(`   ${alignmentResults.invariants.valid ? '✓' : '✗'} INV-A (Evidence Anchoring): ${alignmentResults.invariants.invariants.inv_a.status}`);
  console.log(`   ${alignmentResults.invariants.valid ? '✓' : '✗'} INV-B (Probe Determinism): ${alignmentResults.invariants.invariants.inv_b.status}`);
  console.log(`   ${alignmentResults.invariants.valid ? '✓' : '✗'} INV-C (Partition Stability): ${alignmentResults.invariants.invariants.inv_c.status}`);
  console.log();

  // 10. Generate Reports
  console.log('10. Generating reports...');
  const alignmentReport = alignmentPack.generateReport(alignmentResults);
  
  console.log('   ✓ Alignment report generated');
  console.log();

  // 11. Output Summary
  console.log('='.repeat(70));
  console.log('ANALYSIS SUMMARY');
  console.log('='.repeat(70));
  console.log();
  console.log('CER Core:');
  console.log(`  Posts analyzed: ${cerResults.summary.uniquePosts}`);
  console.log(`  Blocks created: ${cerResults.summary.blockCount}`);
  console.log(`  Invariants: ${cerValidation.valid ? 'PASS' : 'FAIL'}`);
  console.log();
  console.log('Alignment Pack:');
  console.log(`  Risk score: ${alignmentResults.aggregateRisk.score.toFixed(3)} (${alignmentResults.aggregateRisk.category})`);
  console.log(`  SHIFT: ${(alignmentResults.signals.shift?.score || 0).toFixed(3)}`);
  console.log(`  GAME: ${(alignmentResults.signals.game?.score || 0).toFixed(3)}`);
  console.log(`  DECEPT: ${(alignmentResults.signals.decept?.score || 0).toFixed(3)}`);
  console.log(`  CORRIG: ${(alignmentResults.signals.corrig?.score || 0).toFixed(3)}`);
  console.log(`  Invariants: ${alignmentResults.invariants.valid ? 'PASS' : 'FAIL'}`);
  console.log();
  console.log('Probing:');
  console.log(`  Current rate: ${(schedule.probeRate * 100).toFixed(0)}%`);
  console.log(`  Surge active: ${schedule.surgeActivated ? 'YES' : 'NO'}`);
  console.log(`  Probes executed: ${probeSelection.probes.length}`);
  console.log(`  SOPHRON messages: ${alignmentResults.sophronMessages.length}`);
  console.log();
  console.log('='.repeat(70));
  console.log();

  // 12. Save to file (optional)
  if (process.argv.includes('--save')) {
    const reporter = new OutputReporter(config, logger);
    const outputs = await reporter.writeOutputs(
      cerResults,
      cerValidation,
      {
        runId: 'alignment_demo',
        alignment: alignmentResults.toJSON()
      }
    );
    console.log(`Results saved to: ${outputs.dir}`);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };
