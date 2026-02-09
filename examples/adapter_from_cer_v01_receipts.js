#!/usr/bin/env node

/**
 * Adapter: CER-Telemetry (v0.1 receipts) -> SOPHRON-CER alignment pack
 *
 * Usage:
 *   node examples/adapter_from_cer_v01_receipts.js \
 *     --receipts-dir "../outputs/receipts" \
 *     --out "../outputs/sophron_alignment_report.json"
 *
 * Notes:
 * - This is intentionally conservative: it does NOT assume any particular
 *   SOPHRON-1 payload exists in receipts; it just passes receipts through.
 * - It is safe to run when receipts are empty or partial.
 */

import fs from 'fs/promises';
import path from 'path';

import { createAlignmentPack } from '../lib/alignment/index.js';
import { loadConfig } from '../config/schema.js';
import { createLogger } from '../lib/utils/logger.js';

function parseArgs(argv) {
  const out = { receiptsDir: '../outputs/receipts', outPath: './alignment-report.json' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--receipts-dir') out.receiptsDir = argv[++i];
    else if (a === '--out') out.outPath = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node examples/adapter_from_cer_v01_receipts.js --receipts-dir <dir> --out <file>');
      process.exit(0);
    }
  }
  return out;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const args = parseArgs(process.argv);

  const receiptsDir = path.resolve(process.cwd(), args.receiptsDir);
  const outPath = path.resolve(process.cwd(), args.outPath);

  const config = loadConfig({
    logging: { level: 'info', pretty: true },
  });
  const logger = createLogger(config.logging);

  logger.info({ receiptsDir }, 'Loading CER v0.1 receipts');

  let files = [];
  try {
    files = (await fs.readdir(receiptsDir))
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(receiptsDir, f));
  } catch (e) {
    logger.warn({ error: String(e?.message ?? e) }, 'Receipts dir not readable; proceeding with empty set');
    files = [];
  }

  const receipts = [];
  for (const f of files) {
    try {
      const r = await readJson(f);
      // Minimal normalization: ensure runId exists
      if (!r.runId && r.run_id) r.runId = r.run_id;
      receipts.push(r);
    } catch (e) {
      logger.warn({ file: f, error: String(e?.message ?? e) }, 'Skipping invalid receipt JSON');
    }
  }

  logger.info({ receiptCount: receipts.length }, 'Receipts loaded');

  const pack = createAlignmentPack(config, logger);

  // Context can be enriched later (model version, cohort drift, etc.).
  const context = {
    source: 'cer-telemetry-v0.1',
    now: Date.now(),
  };

  // No probes yet: empty object is acceptable.
  const probeResults = {};

  const analysis = await pack.analyze(receipts, probeResults, context);
  const report = pack.generateReport(analysis);

  const outObj = {
    kind: 'sophron_alignment_report_v0',
    generated_at: new Date().toISOString(),
    input: {
      receipts_dir: receiptsDir,
      receipts_count: receipts.length,
    },
    report,
    analysis: analysis.toJSON(),
  };

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(outObj, null, 2), 'utf8');

  logger.info({ outPath }, 'Wrote alignment report');
  console.log(JSON.stringify({ ok: true, outPath, receipts: receipts.length }, null, 2));
}

await main();
