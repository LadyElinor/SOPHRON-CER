import fs from 'fs/promises';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import crypto from 'crypto';

/**
 * Output reporter for multiple formats
 */
export class OutputReporter {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Generate run ID
   * @returns {string} Unique run ID
   */
  generateRunId() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const hash = crypto.randomBytes(4).toString('hex');
    return `run_${timestamp}_${hash}`;
  }

  /**
   * Create output directory for a run
   * @param {string} runId - Run identifier
   * @returns {Promise<string>} Directory path
   */
  async createOutputDirectory(runId) {
    const dir = path.join(this.config.output.baseDir, runId);
    await fs.mkdir(dir, { recursive: true });
    this.logger.info({ dir }, 'Created output directory');
    return dir;
  }

  /**
   * Generate metadata for a run
   * @param {Object} analysisResults - Analysis results
   * @param {Object} additionalMeta - Additional metadata
   * @returns {Object} Complete metadata
   */
  generateMetadata(analysisResults, additionalMeta = {}) {
    return {
      runId: additionalMeta.runId,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      codeVersion: additionalMeta.codeVersion || 'unknown',
      configHash: this.hashConfig(this.config),
      config: this.config,
      summary: analysisResults.summary,
      validation: additionalMeta.validation,
      ...additionalMeta
    };
  }

  /**
   * Hash configuration for determinism tracking
   * @param {Object} config - Configuration object
   * @returns {string} Configuration hash
   */
  hashConfig(config) {
    const configStr = JSON.stringify(config, Object.keys(config).sort());
    return crypto.createHash('sha256').update(configStr).digest('hex').substring(0, 16);
  }

  /**
   * Write JSON output
   * @param {string} dir - Output directory
   * @param {string} filename - Filename
   * @param {Object} data - Data to write
   */
  async writeJson(dir, filename, data) {
    const filepath = path.join(dir, filename);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
    this.logger.info({ filepath }, 'Wrote JSON file');
  }

  /**
   * Write CSV output
   * @param {string} dir - Output directory
   * @param {string} filename - Filename
   * @param {Array<Object>} records - Records to write
   */
  async writeCsv(dir, filename, records) {
    if (!records || records.length === 0) {
      this.logger.warn({ filename }, 'No records to write to CSV');
      return;
    }

    const filepath = path.join(dir, filename);
    
    // Extract headers from first record
    const headers = Object.keys(records[0]).map(key => ({
      id: key,
      title: key
    }));

    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: headers
    });

    await csvWriter.writeRecords(records);
    this.logger.info({ filepath, recordCount: records.length }, 'Wrote CSV file');
  }

  /**
   * Flatten nested object for CSV export
   * @param {Object} obj - Object to flatten
   * @param {string} prefix - Prefix for keys
   * @returns {Object} Flattened object
   */
  flattenObject(obj, prefix = '') {
    const flattened = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value === null || value === undefined) {
        flattened[newKey] = '';
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        flattened[newKey] = JSON.stringify(value);
      } else {
        flattened[newKey] = value;
      }
    }

    return flattened;
  }

  /**
   * Convert block analysis to CSV records
   * @param {Object} blocks - Block analysis results
   * @returns {Array<Object>} CSV records
   */
  blocksToRecords(blocks) {
    const records = [];

    for (const [blockKey, block] of Object.entries(blocks)) {
      const baseRecord = {
        blockKey,
        sampleSize: block.sampleSize,
        ...this.flattenObject({ impressionStats: block.impressionStats })
      };

      // Add prevalence data
      for (const [feature, prev] of Object.entries(block.prevalences)) {
        baseRecord[`${feature}_count`] = prev.count;
        baseRecord[`${feature}_total`] = prev.total;
        baseRecord[`${feature}_prevalence`] = prev.prevalence;
        baseRecord[`${feature}_ci_lower`] = prev.confidence.lower;
        baseRecord[`${feature}_ci_upper`] = prev.confidence.upper;
      }

      records.push(baseRecord);
    }

    return records;
  }

  /**
   * Generate HTML report
   * @param {Object} metadata - Run metadata
   * @param {Object} analysisResults - Analysis results
   * @param {Object} validationResults - Validation results
   * @returns {string} HTML content
   */
  generateHtmlReport(metadata, analysisResults, validationResults) {
    const { summary, overall, blocks } = analysisResults;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CER-Telemetry Report - ${metadata.runId}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; }
    h3 { color: #7f8c8d; }
    .metric { 
      display: inline-block;
      margin: 10px 20px 10px 0;
      padding: 10px 15px;
      background: #ecf0f1;
      border-radius: 4px;
    }
    .metric-label { font-weight: bold; color: #7f8c8d; }
    .metric-value { font-size: 1.2em; color: #2c3e50; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #3498db;
      color: white;
      font-weight: bold;
    }
    tr:hover { background-color: #f5f5f5; }
    .success { color: #27ae60; font-weight: bold; }
    .warning { color: #f39c12; font-weight: bold; }
    .error { color: #e74c3c; font-weight: bold; }
    .violation {
      background: #fff5f5;
      border-left: 4px solid #e74c3c;
      padding: 10px;
      margin: 10px 0;
    }
    code {
      background: #ecf0f1;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>CER-Telemetry Analysis Report</h1>
    
    <div class="section">
      <h2>Run Information</h2>
      <div class="metric">
        <div class="metric-label">Run ID</div>
        <div class="metric-value"><code>${metadata.runId}</code></div>
      </div>
      <div class="metric">
        <div class="metric-label">Timestamp</div>
        <div class="metric-value">${metadata.timestamp}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Config Hash</div>
        <div class="metric-value"><code>${metadata.configHash}</code></div>
      </div>
    </div>

    <div class="section">
      <h2>Validation Status</h2>
      ${validationResults.valid 
        ? '<p class="success">✓ All invariants validated successfully</p>'
        : `<p class="error">✗ ${validationResults.violations.length} invariant violation(s) detected</p>`
      }
      ${validationResults.violations.map(v => `
        <div class="violation">
          <strong>${v.invariant}</strong>: ${v.message}
          <br><code>${JSON.stringify(v.details)}</code>
        </div>
      `).join('')}
    </div>

    <div class="section">
      <h2>Summary Statistics</h2>
      <div class="metric">
        <div class="metric-label">Raw Posts</div>
        <div class="metric-value">${summary.rawPosts.toLocaleString()}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Unique Posts</div>
        <div class="metric-value">${summary.uniquePosts.toLocaleString()}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Blocks</div>
        <div class="metric-value">${summary.blockCount}</div>
      </div>
    </div>

    <div class="section">
      <h2>Overall Prevalence</h2>
      <table>
        <thead>
          <tr>
            <th>Feature</th>
            <th>Count</th>
            <th>Prevalence</th>
            <th>95% CI</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(overall.prevalences).map(([feature, prev]) => `
            <tr>
              <td>${feature}</td>
              <td>${prev.count} / ${prev.total}</td>
              <td>${(prev.prevalence * 100).toFixed(2)}%</td>
              <td>[${(prev.confidence.lower * 100).toFixed(2)}%, ${(prev.confidence.upper * 100).toFixed(2)}%]</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Block Analysis</h2>
      ${Object.entries(blocks).map(([blockKey, block]) => `
        <h3>${blockKey} (n=${block.sampleSize})</h3>
        <table>
          <thead>
            <tr>
              <th>Feature</th>
              <th>Count</th>
              <th>Prevalence</th>
              <th>Weighted Prevalence</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(block.prevalences).map(([feature, prev]) => `
              <tr>
                <td>${feature}</td>
                <td>${prev.count} / ${prev.total}</td>
                <td>${(prev.prevalence * 100).toFixed(2)}%</td>
                <td>${(block.weightedPrevalences[feature].prevalence * 100).toFixed(2)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `).join('')}
    </div>

    <div class="section">
      <h2>Metadata</h2>
      <pre><code>${JSON.stringify(metadata, null, 2)}</code></pre>
    </div>
  </div>
</body>
</html>`;

    return html;
  }

  /**
   * Write all outputs for a run
   * @param {Object} analysisResults - Analysis results
   * @param {Object} validationResults - Validation results
   * @param {Object} additionalMeta - Additional metadata
   * @returns {Promise<Object>} Output paths
   */
  async writeOutputs(analysisResults, validationResults, additionalMeta = {}) {
    const runId = additionalMeta.runId || this.generateRunId();
    const dir = await this.createOutputDirectory(runId);

    const metadata = this.generateMetadata(analysisResults, {
      ...additionalMeta,
      runId,
      validation: validationResults
    });

    const outputs = { runId, dir, files: {} };

    // Write metadata
    await this.writeJson(dir, 'meta.json', metadata);
    outputs.files.meta = path.join(dir, 'meta.json');

    // Write formats specified in config
    if (this.config.output.formats.includes('json')) {
      await this.writeJson(dir, 'analysis.json', analysisResults);
      outputs.files.analysis = path.join(dir, 'analysis.json');

      await this.writeJson(dir, 'validation.json', validationResults);
      outputs.files.validation = path.join(dir, 'validation.json');
    }

    if (this.config.output.formats.includes('csv')) {
      if (analysisResults.blocks) {
        const records = this.blocksToRecords(analysisResults.blocks);
        await this.writeCsv(dir, 'blocks.csv', records);
        outputs.files.blocks = path.join(dir, 'blocks.csv');
      }
    }

    if (this.config.output.formats.includes('html') && this.config.output.generateReport) {
      const html = this.generateHtmlReport(metadata, analysisResults, validationResults);
      await fs.writeFile(path.join(dir, 'report.html'), html, 'utf-8');
      outputs.files.report = path.join(dir, 'report.html');
      this.logger.info({ filepath: path.join(dir, 'report.html') }, 'Generated HTML report');
    }

    this.logger.info({ runId, dir, fileCount: Object.keys(outputs.files).length }, 
      'Wrote all outputs');

    return outputs;
  }
}
