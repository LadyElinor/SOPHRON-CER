# CER-Telemetry v2.0 - Improved

Enhanced CER-Telemetry pipeline with modular architecture, advanced statistical analysis, and comprehensive invariant validation.

## What's New in v2.0

### Architecture Improvements
- **Modular Design**: Separated concerns into collectors, analyzers, validators, and reporters
- **Configuration Management**: Schema-validated configuration with environment-specific overrides
- **Structured Logging**: JSON-structured logging with pino for better observability
- **Error Handling**: Retry logic with exponential backoff and circuit breakers

### Statistical Enhancements
- **Confidence Intervals**: Wilson score intervals for all prevalence estimates
- **Effect Sizes**: Cohen's h for comparing proportions
- **Hypothesis Testing**: Chi-square and Fisher's exact tests
- **Trend Detection**: Mann-Kendall test for temporal patterns
- **Weighted Analysis**: Impression-weighted prevalence calculations

### Validation & Safety
- **Invariant Enforcement**: Comprehensive contract validation
- **PII Detection**: Automatic detection and redaction of sensitive information
- **Determinism Tracking**: Configuration hashing for reproducibility
- **Provenance**: Complete metadata capture for audit trails

### Output & Reporting
- **Multiple Formats**: JSON, CSV, Parquet, and HTML reports
- **Interactive Reports**: HTML dashboards with visualizations
- **Comparison Tools**: Built-in run comparison functionality

## Installation

```bash
npm install
```

## Configuration

### Environment Variables

Create a `.env` file:

```bash
# API Configuration
MOLTX_API_TOKEN=your_api_token_here
MOLTX_API_URL=https://api.moltx.example.com

# Logging
LOG_LEVEL=info
LOG_FILE=/path/to/logs/cer-telemetry.log

# Environment
NODE_ENV=production
```

### Configuration File

Create `config/custom.json` for custom settings:

```json
{
  "sampling": {
    "minSampleSize": 200,
    "maxSampleSize": 20000
  },
  "analysis": {
    "confidenceLevel": 0.99,
    "minBlockSize": 50
  },
  "privacy": {
    "enablePiiDetection": true,
    "kAnonymity": 10
  }
}
```

## Usage

### Basic Analysis

Run a complete analysis:

```bash
node src/cli.js analyze
```

### Advanced Options

```bash
# Dry run with mock data
node src/cli.js analyze --dry-run

# Custom sample size
node src/cli.js analyze --max-samples 5000

# Custom output formats
node src/cli.js analyze --formats json,csv,html

# Debug logging
node src/cli.js analyze --log-level debug

# JSON-structured logs
node src/cli.js analyze --json
```

### Validation

Validate an existing run:

```bash
node src/cli.js validate run_2024-02-08_abc123

# Save validation report
node src/cli.js validate run_2024-02-08_abc123 -o validation.json
```

### Comparison

Compare two runs:

```bash
node src/cli.js compare run_2024-02-08_abc123 run_2024-02-09_def456

# Save comparison report
node src/cli.js compare run_2024-02-08_abc123 run_2024-02-09_def456 -o comparison.json
```

### List Runs

View all available runs:

```bash
node src/cli.js list
```

## Project Structure

```
cer-telemetry-improved/
├── config/
│   └── schema.js              # Configuration schema and validation
├── lib/
│   ├── collectors/
│   │   └── moltx-collector.js # API data collection
│   ├── analyzers/
│   │   ├── statistical-analyzer.js   # Statistical methods
│   │   └── prevalence-analyzer.js    # Prevalence analysis
│   ├── validators/
│   │   └── invariant-validator.js    # Invariant checking
│   ├── reporters/
│   │   └── output-reporter.js        # Multi-format output
│   └── utils/
│       ├── logger.js          # Structured logging
│       └── pii-detector.js    # PII detection
├── src/
│   └── cli.js                 # Command-line interface
├── test/
│   └── *.test.js             # Test suites
├── outputs/                   # Analysis outputs (gitignored)
└── package.json
```

## Programmatic Usage

```javascript
import { loadConfig } from './config/schema.js';
import { createLogger } from './lib/utils/logger.js';
import { MoltxCollector } from './lib/collectors/moltx-collector.js';
import { PrevalenceAnalyzer } from './lib/analyzers/prevalence-analyzer.js';
import { InvariantValidator } from './lib/validators/invariant-validator.js';
import { OutputReporter } from './lib/reporters/output-reporter.js';

// Load configuration
const config = loadConfig();
const logger = createLogger(config.logging);

// Initialize components
const collector = new MoltxCollector(config, logger);
await collector.initialize();

// Fetch data
const posts = await collector.fetchPaginated({}, 1000);

// Analyze
const analyzer = new PrevalenceAnalyzer(config, logger);
const results = analyzer.analyze(posts);

// Validate
const validator = new InvariantValidator(config, logger);
const validation = validator.validate(results, {
  runId: 'custom_run',
  codeVersion: 'v2.0.0'
});

// Generate outputs
const reporter = new OutputReporter(config, logger);
await reporter.writeOutputs(results, validation);
```

## Testing

Run test suite:

```bash
npm test
```

Run tests with watch mode:

```bash
npm run test:watch
```

## Invariants

The system enforces the following invariants:

### 1. Determinism
- Same inputs produce same outputs
- Configuration hashing for reproducibility
- Code version tracking

### 2. Monotonic Gating
- Minimum sample sizes enforced
- Minimum block sizes required
- Prevents unreliable estimates

### 3. Partition Sanity
- Blocks are well-defined
- No overlap between blocks
- Total consistency checks

### 4. Denominator Hygiene
- No division by zero
- No NaN or Infinity values
- Safe prevalence calculations

### 5. Provenance Completeness
- Full metadata capture
- Timestamp tracking
- Configuration preservation

## Output Files

Each run produces:

### `meta.json`
Complete metadata including:
- Run ID and timestamp
- Configuration hash
- System information
- Validation results

### `analysis.json`
Full analysis results:
- Summary statistics
- Block-level analysis
- Prevalence estimates with CIs
- Overlap calculations

### `blocks.csv`
Tabular format with:
- Block identifiers
- Sample sizes
- Prevalence metrics
- Confidence intervals

### `report.html`
Interactive HTML dashboard with:
- Summary visualizations
- Block comparisons
- Validation status
- Complete metadata

## Privacy & Safety

### PII Detection
Automatic detection of:
- Email addresses
- Phone numbers
- SSNs and credit cards
- IP addresses
- API keys

### Redaction
```javascript
const piiDetector = new PiiDetector(config, logger);

// Detect PII
const findings = piiDetector.scanObject(data);

// Redact PII
const clean = piiDetector.redactObject(data);
```

### K-Anonymity
Configure minimum group sizes:
```json
{
  "privacy": {
    "kAnonymity": 5
  }
}
```

## Statistical Methods

### Confidence Intervals
Wilson score intervals for proportions (recommended over Wald intervals):
```javascript
const ci = stats.wilsonConfidenceInterval(successes, total, 0.95);
// Returns: { point, lower, upper, confidence }
```

### Effect Sizes
Cohen's h for comparing proportions:
```javascript
const effect = stats.cohensH(p1, p2);
// Returns: { h, interpretation }
// Interpretation: negligible, small, medium, large
```

### Hypothesis Testing
```javascript
// Chi-square for independence
const chiSq = stats.chiSquareTest([[a,b],[c,d]]);
// Returns: { chiSquare, df, pValue, significant }

// Fisher's exact for small samples
const fisher = stats.fishersExactTest([[a,b],[c,d]]);
// Returns: { pValue, significant, oddsRatio }
```

### Trend Detection
Mann-Kendall test for monotonic trends:
```javascript
const trend = stats.mannKendallTest(timeSeries);
// Returns: { S, tau, Z, trend, significant }
```

## Error Handling

### API Errors
- Automatic retry with exponential backoff
- Rate limiting with token bucket
- Circuit breaker pattern

### Validation Errors
```javascript
try {
  validator.throwIfInvalid();
} catch (error) {
  // Handle validation failure
  console.error(error.message);
}
```

## Performance Considerations

### Rate Limiting
Configure API rate limits:
```json
{
  "api": {
    "rateLimit": {
      "maxRequests": 100,
      "windowMs": 60000
    }
  }
}
```

### Memory Management
For large datasets, use streaming:
```javascript
const posts = [];
for await (const batch of collector.fetchBatches()) {
  posts.push(...batch);
  // Process incrementally
}
```

## Contributing

1. Write tests for new features
2. Follow existing code style
3. Update documentation
4. Ensure invariants pass

## License

TBD

## Acknowledgments

Based on the original CER-Telemetry by LadyElinor, with significant enhancements for production use.
