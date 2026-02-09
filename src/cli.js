#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { loadConfig } from '../config/schema.js';
import { createLogger } from '../lib/utils/logger.js';
import { MoltxCollector } from '../lib/collectors/moltx-collector.js';
import { PrevalenceAnalyzer } from '../lib/analyzers/prevalence-analyzer.js';
import { InvariantValidator } from '../lib/validators/invariant-validator.js';
import { OutputReporter } from '../lib/reporters/output-reporter.js';
import { PiiDetector } from '../lib/utils/pii-detector.js';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const program = new Command();

/**
 * Main analysis workflow
 */
async function runAnalysis(options) {
  // Load configuration
  const config = loadConfig({
    logging: {
      level: options.logLevel || 'info',
      pretty: !options.json
    },
    sampling: {
      maxSampleSize: options.maxSamples || 10000
    },
    output: {
      formats: options.formats ? options.formats.split(',') : ['json', 'csv', 'html']
    }
  });

  const logger = createLogger(config.logging);
  logger.info({ config: config }, 'Starting CER-Telemetry analysis');

  try {
    // Initialize collector
    const collector = new MoltxCollector(config, logger);
    await collector.initialize();

    // Fetch data
    logger.info('Fetching posts from MoltX API');
    const posts = options.dryRun 
      ? await loadMockData()
      : await collector.fetchPaginated({}, config.sampling.maxSampleSize);

    logger.info({ postCount: posts.length }, 'Fetched posts');

    // Check for PII
    const piiDetector = new PiiDetector(config, logger);
    piiDetector.scanAndLog(posts, 'raw_posts');

    // Analyze
    const analyzer = new PrevalenceAnalyzer(config, logger);
    const analysisResults = analyzer.analyze(posts);

    // Validate
    const validator = new InvariantValidator(config, logger);
    const metadata = {
      runId: options.runId,
      codeVersion: await getGitCommit(),
      nodeVersion: process.version
    };
    const validationResults = validator.validate(analysisResults, metadata);

    // Generate report
    const validationReport = validator.generateReport();
    logger.info({ validationReport }, 'Validation complete');

    // Throw if validation failed and configured to do so
    if (!options.skipValidation) {
      validator.throwIfInvalid();
    }

    // Write outputs
    const reporter = new OutputReporter(config, logger);
    const outputs = await reporter.writeOutputs(
      analysisResults,
      validationResults,
      metadata
    );

    logger.info({ outputs }, 'Analysis complete');

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('CER-TELEMETRY ANALYSIS COMPLETE');
    console.log('='.repeat(60));
    console.log(`Run ID: ${outputs.runId}`);
    console.log(`Output Directory: ${outputs.dir}`);
    console.log(`\nFiles generated:`);
    for (const [name, filepath] of Object.entries(outputs.files)) {
      console.log(`  - ${name}: ${filepath}`);
    }
    console.log(`\nValidation: ${validationResults.valid ? '✓ PASSED' : '✗ FAILED'}`);
    if (!validationResults.valid) {
      console.log(`Violations: ${validationResults.violations.length}`);
    }
    console.log('='.repeat(60) + '\n');

    return outputs;

  } catch (error) {
    logger.error({ error }, 'Analysis failed');
    throw error;
  }
}

/**
 * Validate existing run outputs
 */
async function validateRun(runId, options) {
  const config = loadConfig({
    logging: {
      level: options.logLevel || 'info',
      pretty: !options.json
    }
  });

  const logger = createLogger(config.logging);

  try {
    const runDir = path.join(config.output.baseDir, runId);
    
    // Load analysis results
    const analysisPath = path.join(runDir, 'analysis.json');
    const analysisResults = JSON.parse(await fs.readFile(analysisPath, 'utf-8'));

    // Load metadata
    const metaPath = path.join(runDir, 'meta.json');
    const metadata = JSON.parse(await fs.readFile(metaPath, 'utf-8'));

    // Re-validate
    const validator = new InvariantValidator(config, logger);
    const validationResults = validator.validate(analysisResults, metadata);

    const report = validator.generateReport();
    
    if (options.output) {
      await fs.writeFile(
        options.output,
        JSON.stringify(report, null, 2),
        'utf-8'
      );
      logger.info({ output: options.output }, 'Wrote validation report');
    } else {
      console.log(JSON.stringify(report, null, 2));
    }

    return report;

  } catch (error) {
    logger.error({ error, runId }, 'Validation failed');
    throw error;
  }
}

/**
 * Compare two runs
 */
async function compareRuns(runId1, runId2, options) {
  const config = loadConfig({
    logging: {
      level: options.logLevel || 'info'
    }
  });

  const logger = createLogger(config.logging);

  try {
    // Load both runs
    const run1Path = path.join(config.output.baseDir, runId1, 'analysis.json');
    const run2Path = path.join(config.output.baseDir, runId2, 'analysis.json');

    const run1 = JSON.parse(await fs.readFile(run1Path, 'utf-8'));
    const run2 = JSON.parse(await fs.readFile(run2Path, 'utf-8'));

    // Create analyzer for comparison
    const analyzer = new PrevalenceAnalyzer(config, logger);

    // Compare overall results
    const comparison = analyzer.compareBlocks(run1.overall, run2.overall);

    const report = {
      run1: runId1,
      run2: runId2,
      comparison
    };

    if (options.output) {
      await fs.writeFile(
        options.output,
        JSON.stringify(report, null, 2),
        'utf-8'
      );
      logger.info({ output: options.output }, 'Wrote comparison report');
    } else {
      console.log(JSON.stringify(report, null, 2));
    }

    return report;

  } catch (error) {
    logger.error({ error, runId1, runId2 }, 'Comparison failed');
    throw error;
  }
}

/**
 * Get git commit hash for provenance
 */
async function getGitCommit() {
  try {
    const { execSync } = await import('child_process');
    const commit = execSync('git rev-parse --short HEAD', { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    return commit;
  } catch {
    return 'unknown';
  }
}

/**
 * Load mock data for dry-run mode
 */
async function loadMockData() {
  return Array.from({ length: 1000 }, (_, i) => ({
    id: `post_${i}`,
    content: [
      'Check out this new token offering!',
      'Our API is secure and ready for production',
      'Click here for limited time offer',
      'Receipt confirmed for your purchase',
      'Engineering best practices for deployment'
    ][i % 5],
    impressions: Math.floor(Math.random() * 100000),
    source: i % 2 === 0 ? 'top' : 'fallback',
    timestamp: Date.now() - Math.floor(Math.random() * 86400000)
  }));
}

// Define CLI commands
program
  .name('cer-telemetry')
  .description('CER-Telemetry: Content Cohort Analysis with Safety Invariants')
  .version('2.0.0');

program
  .command('analyze')
  .description('Run full telemetry analysis pipeline')
  .option('-m, --max-samples <number>', 'Maximum number of samples', '10000')
  .option('-r, --run-id <id>', 'Custom run ID')
  .option('--dry-run', 'Use mock data instead of API', false)
  .option('--skip-validation', 'Skip invariant validation', false)
  .option('--formats <formats>', 'Output formats (json,csv,html)', 'json,csv,html')
  .option('--log-level <level>', 'Log level', 'info')
  .option('--json', 'Output logs as JSON', false)
  .action(runAnalysis);

program
  .command('validate <runId>')
  .description('Validate invariants for an existing run')
  .option('-o, --output <file>', 'Output file for validation report')
  .option('--log-level <level>', 'Log level', 'info')
  .option('--json', 'Output as JSON', false)
  .action(validateRun);

program
  .command('compare <runId1> <runId2>')
  .description('Compare two analysis runs')
  .option('-o, --output <file>', 'Output file for comparison report')
  .option('--log-level <level>', 'Log level', 'info')
  .action(compareRuns);

program
  .command('list')
  .description('List all available runs')
  .action(async () => {
    const config = loadConfig();
    const entries = await fs.readdir(config.output.baseDir);
    
    console.log('\nAvailable runs:');
    for (const entry of entries) {
      const metaPath = path.join(config.output.baseDir, entry, 'meta.json');
      try {
        const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
        console.log(`  ${entry}`);
        console.log(`    Timestamp: ${meta.timestamp}`);
        console.log(`    Unique Posts: ${meta.summary.uniquePosts}`);
      } catch {
        // Skip invalid entries
      }
    }
    console.log();
  });

program.parse(process.argv);
