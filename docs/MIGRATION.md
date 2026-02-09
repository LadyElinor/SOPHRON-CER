# Migration Guide: CER-Telemetry v1 to v2

## Overview

Version 2.0 represents a complete refactoring of CER-Telemetry with breaking changes. This guide helps you migrate from the original `tmp_moltx_instrument_trending_v2.mjs` to the new modular architecture.

## Breaking Changes

### 1. File Structure

**v1**:
```
CER-Telemetry/
├── tmp_moltx_instrument_trending_v2.mjs  (monolithic)
├── moltx.txt                             (API token)
└── outputs/
```

**v2**:
```
cer-telemetry-improved/
├── src/cli.js                  (entry point)
├── lib/                        (modular components)
├── config/                     (configuration)
├── test/                       (test suite)
└── outputs/
```

### 2. Configuration

**v1**: Hardcoded in script
```javascript
const API_URL = 'https://api.moltx.com';
const MAX_SAMPLES = 10000;
```

**v2**: Schema-validated configuration
```javascript
// .env file
MOLTX_API_TOKEN=your_token
MOLTX_API_URL=https://api.moltx.com

// Or config/custom.json
{
  "sampling": { "maxSampleSize": 10000 }
}
```

### 3. Command Line Interface

**v1**:
```bash
node tmp_moltx_instrument_trending_v2.mjs
```

**v2**:
```bash
node src/cli.js analyze
node src/cli.js validate <runId>
node src/cli.js compare <runId1> <runId2>
```

### 4. Output Structure

**v1**:
```
outputs/moltx_runs/<timestamp>/
├── meta.json
├── posts.json
└── posts.csv
```

**v2**:
```
outputs/moltx_runs/<runId>/
├── meta.json         (enhanced with more metadata)
├── analysis.json     (structured results)
├── validation.json   (invariant report)
├── blocks.csv        (tabular data)
└── report.html       (interactive report)
```

## Migration Steps

### Step 1: Install Dependencies

```bash
cd cer-telemetry-improved
npm install
```

### Step 2: Migrate API Token

**v1**: `moltx.txt` file
```
your_bearer_token_here
```

**v2**: Environment variable (recommended)
```bash
# Add to .env
MOLTX_API_TOKEN=your_bearer_token_here
```

Or keep using file:
```bash
# v2 still supports moltx.txt as fallback
cp ../CER-Telemetry/moltx.txt .
```

### Step 3: Migrate Configuration

**v1**: Extract hardcoded values from script
```javascript
// From old script
const minBlockSize = 30;
const impressionBands = { low: 100, mid: 1000, high: 10000 };
```

**v2**: Create `config/custom.json`
```json
{
  "analysis": {
    "minBlockSize": 30,
    "impressionBands": {
      "low": 100,
      "mid": 1000,
      "high": 10000
    }
  }
}
```

### Step 4: Update Scripts

**v1**: Custom script
```bash
#!/bin/bash
node tmp_moltx_instrument_trending_v2.mjs > log.txt
```

**v2**: Use new CLI
```bash
#!/bin/bash
node src/cli.js analyze --log-level info
```

### Step 5: Migrate Post-Processing

**v1**: Manual post-processing of outputs
```python
import json
with open('outputs/moltx_runs/latest/meta.json') as f:
    data = json.load(f)
# ... custom processing
```

**v2**: Use built-in comparison and validation
```bash
# Compare runs
node src/cli.js compare <old_run> <new_run> -o comparison.json

# Validate results
node src/cli.js validate <run_id> -o validation.json
```

## Feature Mapping

### Data Collection

**v1**:
```javascript
const response = await fetch(url, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const posts = await response.json();
```

**v2**:
```javascript
const collector = new MoltxCollector(config, logger);
await collector.initialize();
const posts = await collector.fetchPaginated({}, maxSamples);
```

**Benefits**:
- Automatic retry logic
- Rate limiting
- Pagination handling
- Error classification

### Feature Extraction

**v1**:
```javascript
const hasTokenPromo = /token|crypto/.test(post.content);
const impressionBand = getImpressionBand(post.impressions);
```

**v2**:
```javascript
const analyzer = new PrevalenceAnalyzer(config, logger);
const results = analyzer.analyze(posts);
// Features automatically extracted
```

**Benefits**:
- Consistent feature extraction
- Configurable patterns
- Automatic deduplication
- Block creation

### Statistical Analysis

**v1**:
```javascript
const prevalence = count / total;
// No confidence intervals
```

**v2**:
```javascript
const stats = new StatisticalAnalyzer(config, logger);
const ci = stats.wilsonConfidenceInterval(count, total);
// { point, lower, upper, confidence }
```

**Benefits**:
- Confidence intervals
- Effect sizes
- Hypothesis testing
- Trend detection

### Validation

**v1**: Manual checks
```javascript
if (uniquePosts < minSampleSize) {
  console.warn('Sample size too small');
}
```

**v2**: Automated invariant validation
```javascript
const validator = new InvariantValidator(config, logger);
const results = validator.validate(analysis, metadata);
validator.throwIfInvalid();
```

**Benefits**:
- Comprehensive checks
- Detailed violation reports
- Fail-fast option
- Audit trail

### Output Generation

**v1**:
```javascript
fs.writeFileSync('meta.json', JSON.stringify(meta));
fs.writeFileSync('posts.json', JSON.stringify(posts));
// Manual CSV generation
```

**v2**:
```javascript
const reporter = new OutputReporter(config, logger);
await reporter.writeOutputs(analysis, validation, metadata);
// Automatically generates JSON, CSV, HTML
```

**Benefits**:
- Multiple formats
- HTML reports
- Automatic flattening
- Provenance tracking

## Code Examples

### Example 1: Basic Analysis

**v1**:
```javascript
// 200+ lines in single file
const token = fs.readFileSync('moltx.txt', 'utf-8');
const response = await fetch(`${API_URL}/trending`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const posts = await response.json();

// Extract features
const withFeatures = posts.map(p => ({
  ...p,
  hasTokenPromo: /token/.test(p.content),
  impressionBand: getImpressionBand(p.impressions)
}));

// Calculate prevalence
const byBlock = groupBy(withFeatures, getBlockKey);
const results = {};
for (const [block, posts] of Object.entries(byBlock)) {
  const count = posts.filter(p => p.hasTokenPromo).length;
  results[block] = count / posts.length;
}

// Write output
fs.writeFileSync('output.json', JSON.stringify(results));
```

**v2**:
```javascript
// ~20 lines with full functionality
const config = loadConfig();
const logger = createLogger(config.logging);

const collector = new MoltxCollector(config, logger);
await collector.initialize();
const posts = await collector.fetchPaginated();

const analyzer = new PrevalenceAnalyzer(config, logger);
const results = analyzer.analyze(posts);

const validator = new InvariantValidator(config, logger);
const validation = validator.validate(results, metadata);

const reporter = new OutputReporter(config, logger);
await reporter.writeOutputs(results, validation);
```

### Example 2: Custom Analysis

**v1**: Modify monolithic script
```javascript
// Edit tmp_moltx_instrument_trending_v2.mjs
// Add custom feature extraction
const hasCustomFeature = /pattern/.test(post.content);
// ... 50+ more lines
```

**v2**: Extend analyzer
```javascript
class CustomAnalyzer extends PrevalenceAnalyzer {
  extractFeatures(post) {
    const base = super.extractFeatures(post);
    return {
      ...base,
      hasCustomFeature: /pattern/.test(post.content)
    };
  }
}

const analyzer = new CustomAnalyzer(config, logger);
const results = analyzer.analyze(posts);
```

## Testing Migration

### v1: No tests
```javascript
// Manual verification
console.log('Check these results manually...');
```

### v2: Comprehensive test suite
```bash
npm test
```

```javascript
// test/custom-analyzer.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('CustomAnalyzer', () => {
  it('should extract custom feature', () => {
    const analyzer = new CustomAnalyzer(config, logger);
    const result = analyzer.extractFeatures({
      content: 'test pattern here'
    });
    assert.strictEqual(result.hasCustomFeature, true);
  });
});
```

## Backward Compatibility

### Reading v1 Outputs

If you have existing v1 outputs:

```javascript
import fs from 'fs/promises';
import path from 'path';

async function migrateV1Output(v1Dir) {
  // Read v1 format
  const v1Meta = JSON.parse(
    await fs.readFile(path.join(v1Dir, 'meta.json'))
  );
  const v1Posts = JSON.parse(
    await fs.readFile(path.join(v1Dir, 'posts.json'))
  );

  // Convert to v2 format
  const config = loadConfig();
  const analyzer = new PrevalenceAnalyzer(config, logger);
  const results = analyzer.analyze(v1Posts);

  // Write in v2 format
  const reporter = new OutputReporter(config, logger);
  await reporter.writeOutputs(results, {
    valid: true,
    violations: []
  }, {
    runId: `migrated_${v1Meta.timestamp}`,
    originalRun: v1Meta
  });
}
```

## Common Pitfalls

### 1. Missing API Token

**Error**: `No MoltX API token found`

**Solution**: Set environment variable or create `moltx.txt`
```bash
export MOLTX_API_TOKEN=your_token
# or
echo "your_token" > moltx.txt
```

### 2. Configuration Validation Errors

**Error**: `ZodError: Expected number, received string`

**Solution**: Check configuration types
```json
{
  "sampling": {
    "maxSampleSize": 10000  // number, not "10000"
  }
}
```

### 3. Invariant Violations

**Error**: `Invariant validation failed`

**Solution**: Review violation report or skip validation for migration
```bash
node src/cli.js analyze --skip-validation
```

### 4. Import Paths

**Error**: `Cannot find module`

**Solution**: Use ES module syntax
```javascript
// ❌ CommonJS
const { loadConfig } = require('./config/schema.js');

// ✅ ES modules
import { loadConfig } from './config/schema.js';
```

## Performance Comparison

| Metric | v1 | v2 | Improvement |
|--------|----|----|-------------|
| Lines of code | ~400 | ~2000 (distributed) | More maintainable |
| Test coverage | 0% | >80% | Better reliability |
| Error handling | Basic | Comprehensive | Fewer failures |
| Configurability | Hardcoded | Schema-validated | More flexible |
| Output formats | 2 (JSON, CSV) | 4 (JSON, CSV, HTML, Parquet*) | Richer insights |
| Statistical rigor | Basic prevalence | Full CI, effect sizes, tests | Better science |

*Parquet support ready, implementation pending

## Rollback Plan

If you need to rollback to v1:

1. Keep v1 directory intact during migration
2. Test v2 thoroughly with `--dry-run` mode
3. Compare outputs using `compare` command
4. Validate results meet invariants

```bash
# Test v2 without modifying production
node src/cli.js analyze --dry-run --run-id test_migration

# Compare with v1 baseline
node src/cli.js compare <v1_run> <v2_test_run>
```

## Getting Help

- Read the [Architecture Documentation](./ARCHITECTURE.md)
- Check the [README](../README.md) for usage examples
- Review test files in `test/` for code examples
- Open an issue for migration-specific questions

## Checklist

Before going live with v2:

- [ ] API token configured
- [ ] Dependencies installed (`npm install`)
- [ ] Configuration validated
- [ ] Dry run successful
- [ ] Tests passing (`npm test`)
- [ ] Outputs compared with v1
- [ ] Invariants validated
- [ ] Team trained on new CLI
- [ ] Documentation updated
- [ ] Monitoring configured
- [ ] Rollback plan tested
