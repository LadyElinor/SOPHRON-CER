# Quick Start Guide

Get up and running with CER-Telemetry v2.0 in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- MoltX API access and token
- Basic command line knowledge

## Installation

### 1. Clone and Install

```bash
cd cer-telemetry-improved
npm install
```

### 2. Configure API Access

**Option A: Environment Variable (Recommended)**

```bash
cp .env.example .env
# Edit .env and add your token
echo "MOLTX_API_TOKEN=your_actual_token_here" >> .env
```

**Option B: Token File**

```bash
echo "your_actual_token_here" > moltx.txt
```

### 3. Verify Setup

```bash
# Test with mock data (no API calls)
node src/cli.js analyze --dry-run
```

Expected output:
```
============================================================
CER-TELEMETRY ANALYSIS COMPLETE
============================================================
Run ID: run_2024-02-08T12-00-00-000Z_abc123
Output Directory: ./outputs/moltx_runs/run_2024-02-08...

Files generated:
  - meta: ./outputs/.../meta.json
  - analysis: ./outputs/.../analysis.json
  - validation: ./outputs/.../validation.json
  - blocks: ./outputs/.../blocks.csv
  - report: ./outputs/.../report.html

Validation: ✓ PASSED
============================================================
```

## First Real Analysis

### Run Analysis

```bash
node src/cli.js analyze
```

This will:
1. ✓ Load configuration
2. ✓ Connect to MoltX API
3. ✓ Fetch trending posts
4. ✓ Analyze prevalences
5. ✓ Validate invariants
6. ✓ Generate reports

### View Results

```bash
# Open HTML report in browser
open outputs/moltx_runs/<run-id>/report.html

# Or view JSON
cat outputs/moltx_runs/<run-id>/analysis.json | jq .

# Or view CSV in spreadsheet
```

## Common Tasks

### Adjust Sample Size

```bash
# Fetch fewer samples for testing
node src/cli.js analyze --max-samples 1000

# Fetch more samples for production
node src/cli.js analyze --max-samples 20000
```

### Change Output Formats

```bash
# Only JSON
node src/cli.js analyze --formats json

# JSON and CSV
node src/cli.js analyze --formats json,csv

# All formats
node src/cli.js analyze --formats json,csv,html
```

### Enable Debug Logging

```bash
# See detailed logs
node src/cli.js analyze --log-level debug

# JSON-formatted logs for parsing
node src/cli.js analyze --log-level debug --json
```

### Compare Two Runs

```bash
# List available runs
node src/cli.js list

# Compare two runs
node src/cli.js compare run_2024-02-08_abc123 run_2024-02-09_def456

# Save comparison to file
node src/cli.js compare run_2024-02-08_abc123 run_2024-02-09_def456 -o comparison.json
```

### Validate Results

```bash
# Re-validate an existing run
node src/cli.js validate run_2024-02-08_abc123

# Save validation report
node src/cli.js validate run_2024-02-08_abc123 -o validation-report.json
```

## Understanding Output Files

### meta.json
Complete run metadata:
- Run ID and timestamp
- Configuration used
- System information
- Validation summary

```json
{
  "runId": "run_2024-02-08_abc123",
  "timestamp": "2024-02-08T12:00:00.000Z",
  "summary": {
    "rawPosts": 10000,
    "uniquePosts": 9847,
    "blockCount": 12
  }
}
```

### analysis.json
Complete analysis results:
- Overall prevalences
- Block-level analysis
- Confidence intervals
- Overlap statistics

```json
{
  "overall": {
    "prevalences": {
      "hasTokenPromo": {
        "count": 234,
        "total": 9847,
        "prevalence": 0.0238,
        "confidence": {
          "lower": 0.0209,
          "upper": 0.0270
        }
      }
    }
  }
}
```

### blocks.csv
Tabular format for spreadsheet analysis:
- One row per block
- Prevalences and CIs
- Impression statistics

### report.html
Interactive HTML dashboard:
- Visual summary
- Block comparisons
- Validation status
- Full metadata

## Customization

### Create Custom Configuration

```bash
# Copy example config
cp config/production.json config/my-config.json

# Edit settings
vim config/my-config.json

# Use custom config
CONFIG_FILE=config/my-config.json node src/cli.js analyze
```

### Example Custom Settings

```json
{
  "sampling": {
    "maxSampleSize": 5000
  },
  "analysis": {
    "minBlockSize": 100,
    "confidenceLevel": 0.99
  },
  "privacy": {
    "enablePiiDetection": true,
    "kAnonymity": 20
  }
}
```

## Automation

### Schedule Regular Runs

**Using cron**:
```bash
# Run every day at 2 AM
0 2 * * * cd /path/to/cer-telemetry && node src/cli.js analyze >> logs/cron.log 2>&1
```

**Using systemd timer**:
```ini
# /etc/systemd/system/cer-telemetry.timer
[Unit]
Description=CER-Telemetry Daily Analysis

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

### CI/CD Integration

**GitHub Actions**:
```yaml
name: Daily Analysis

on:
  schedule:
    - cron: '0 2 * * *'

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: node src/cli.js analyze
        env:
          MOLTX_API_TOKEN: ${{ secrets.MOLTX_API_TOKEN }}
      - uses: actions/upload-artifact@v3
        with:
          name: analysis-results
          path: outputs/
```

## Troubleshooting

### "No API token found"

```bash
# Check environment variable
echo $MOLTX_API_TOKEN

# Or create token file
echo "your_token" > moltx.txt
```

### "Invariant validation failed"

```bash
# Skip validation for debugging
node src/cli.js analyze --skip-validation

# Check validation details
cat outputs/moltx_runs/<run-id>/validation.json | jq .
```

### "Sample size below minimum"

```bash
# Increase max samples
node src/cli.js analyze --max-samples 20000

# Or reduce minimum in config
```

### Rate Limiting Issues

Edit `config/custom.json`:
```json
{
  "api": {
    "rateLimit": {
      "maxRequests": 50,  // Reduce if hitting limits
      "windowMs": 60000
    }
  }
}
```

## Next Steps

1. **Read the Full Documentation**
   - [README.md](../README.md) - Complete usage guide
   - [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
   - [MIGRATION.md](./MIGRATION.md) - v1 to v2 migration

2. **Run Tests**
   ```bash
   npm test
   ```

3. **Explore Programmatic API**
   ```javascript
   import { loadConfig } from './config/schema.js';
   import { MoltxCollector } from './lib/collectors/moltx-collector.js';
   // ... build custom workflows
   ```

4. **Contribute**
   - Report issues
   - Suggest features
   - Submit pull requests

## Support

- Documentation: `docs/`
- Examples: `test/` directory
- Issues: GitHub Issues
- Email: support@example.com

## Quick Reference

```bash
# Basic commands
node src/cli.js analyze                          # Run analysis
node src/cli.js validate <run-id>                # Validate run
node src/cli.js compare <run1> <run2>            # Compare runs
node src/cli.js list                             # List runs

# Common options
--dry-run                                        # Use mock data
--max-samples <N>                                # Limit samples
--formats json,csv,html                          # Output formats
--log-level debug                                # Verbose logging
--skip-validation                                # Skip invariant checks

# Environment variables
MOLTX_API_TOKEN          # API token (required)
MOLTX_API_URL            # API endpoint
LOG_LEVEL                # Logging level
NODE_ENV                 # Environment (dev/prod)
```

Happy analyzing! 🚀
