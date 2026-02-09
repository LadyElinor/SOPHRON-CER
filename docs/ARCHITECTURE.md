# CER-Telemetry v2.0 Architecture

## Overview

CER-Telemetry v2.0 follows a modular, layered architecture designed for:
- **Separation of Concerns**: Each module has a single, well-defined responsibility
- **Testability**: Pure functions and dependency injection enable comprehensive testing
- **Extensibility**: New collectors, analyzers, and reporters can be added without modifying core code
- **Observability**: Structured logging and metrics at every layer

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLI Layer                              │
│                        (src/cli.js)                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Configuration Layer                           │
│                    (config/schema.js)                           │
│  - Schema validation (Zod)                                      │
│  - Environment variable handling                                │
│  - Default configurations                                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Collector Layer                            │
│              (lib/collectors/*.js)                              │
│  - MoltxCollector: API interaction                              │
│  - Rate limiting                                                │
│  - Retry logic with exponential backoff                         │
│  - Pagination handling                                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Analyzer Layer                             │
│               (lib/analyzers/*.js)                              │
│  - PrevalenceAnalyzer: Feature extraction & blocking            │
│  - StatisticalAnalyzer: Statistical methods                     │
│  - Confidence intervals, effect sizes, hypothesis tests         │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Validator Layer                             │
│              (lib/validators/*.js)                              │
│  - InvariantValidator: Contract enforcement                     │
│  - Determinism checks                                           │
│  - Monotonic gating                                             │
│  - Denominator hygiene                                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Reporter Layer                             │
│               (lib/reporters/*.js)                              │
│  - OutputReporter: Multi-format output                          │
│  - JSON, CSV, HTML generation                                   │
│  - Provenance tracking                                          │
└─────────────────────────────────────────────────────────────────┘

           ┌─────────────────────────────────────┐
           │      Cross-Cutting Concerns         │
           │       (lib/utils/*.js)              │
           │  - Logger: Structured logging       │
           │  - PiiDetector: Privacy protection  │
           └─────────────────────────────────────┘
```

## Component Details

### 1. Configuration Layer

**Purpose**: Centralized configuration management with validation

**Key Features**:
- Schema-based validation using Zod
- Environment variable support
- Configuration hashing for determinism
- Sensible defaults

**Example**:
```javascript
const config = loadConfig({
  sampling: { maxSampleSize: 5000 },
  privacy: { enablePiiDetection: true }
});
```

### 2. Collector Layer

**Purpose**: Data acquisition from external sources

**Components**:
- `MoltxCollector`: Fetches data from MoltX API
- Rate limiter using token bucket algorithm
- Retry logic with exponential backoff
- Circuit breaker pattern (future enhancement)

**Key Features**:
- Configurable rate limits
- Automatic pagination
- Error classification (transient vs permanent)
- Request/response logging

**Example**:
```javascript
const collector = new MoltxCollector(config, logger);
await collector.initialize();
const posts = await collector.fetchPaginated({}, 1000);
```

### 3. Analyzer Layer

**StatisticalAnalyzer**: Core statistical methods

Methods:
- `wilsonConfidenceInterval()`: Confidence intervals for proportions
- `cohensH()`: Effect size for proportion differences
- `chiSquareTest()`: Hypothesis testing
- `mannKendallTest()`: Trend detection
- `relativeRisk()`: Risk ratio calculations

**PrevalenceAnalyzer**: Domain-specific analysis

Responsibilities:
- Feature extraction from posts
- Blocking/stratification
- Prevalence calculation (unweighted and weighted)
- Overlap analysis
- Block comparison

**Data Flow**:
```
Raw Posts → Feature Extraction → Deduplication → Blocking → Analysis
```

### 4. Validator Layer

**InvariantValidator**: Enforces telemetry contracts

**Invariants Checked**:

1. **Determinism**
   - Configuration hash present
   - Code version tracked
   
2. **Monotonic Gating**
   - Minimum sample sizes met
   - Block size thresholds enforced

3. **Partition Sanity**
   - Block totals consistent
   - No empty blocks
   
4. **Denominator Hygiene**
   - No NaN/Infinity values
   - No division by zero

5. **Provenance Completeness**
   - Required metadata present
   - Timestamps valid

6. **Temporal Consistency**
   - Timestamps ordered correctly
   - No future timestamps

**Violation Handling**:
- All violations logged
- Optional fail-fast mode
- Detailed violation reports

### 5. Reporter Layer

**OutputReporter**: Multi-format output generation

**Formats Supported**:
- JSON: Complete structured data
- CSV: Tabular block analysis
- HTML: Interactive reports
- Parquet: Columnar format (future)

**Features**:
- Automatic directory creation
- Metadata generation
- Provenance tracking
- Object flattening for CSV

### 6. Utilities

**Logger**:
- Structured JSON logging
- Configurable log levels
- Pretty printing for development
- File output support
- Operation timing

**PiiDetector**:
- Pattern-based PII detection
- Recursive object scanning
- Automatic redaction
- Privacy reporting

## Data Flow

### Complete Analysis Pipeline

```
1. Configuration Loading
   └─> Validate schema
   └─> Merge with defaults

2. Initialization
   └─> Create logger
   └─> Initialize collector
   └─> Load API credentials

3. Data Collection
   └─> Rate-limited API requests
   └─> Automatic pagination
   └─> Retry on failures
   └─> Raw post collection

4. Privacy Scan
   └─> Detect PII
   └─> Log findings
   └─> Optional redaction

5. Analysis
   └─> Extract features
   └─> Deduplicate by ID
   └─> Create blocks
   └─> Calculate prevalences
   └─> Compute statistics

6. Validation
   └─> Check all invariants
   └─> Generate violations
   └─> Create report

7. Output Generation
   └─> Generate metadata
   └─> Write JSON/CSV/HTML
   └─> Create provenance records
   └─> Save to outputs directory

8. Reporting
   └─> Print summary
   └─> Log completion
   └─> Return output paths
```

## Design Patterns

### 1. Dependency Injection

All components receive dependencies via constructor:

```javascript
class PrevalenceAnalyzer {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.stats = new StatisticalAnalyzer(config, logger);
  }
}
```

**Benefits**:
- Easy testing with mocks
- Clear dependencies
- Configuration propagation

### 2. Strategy Pattern

Different output formats implemented as strategies:

```javascript
if (format === 'json') {
  await this.writeJson(dir, 'analysis.json', data);
} else if (format === 'csv') {
  await this.writeCsv(dir, 'blocks.csv', records);
}
```

### 3. Builder Pattern

Configuration building with validation:

```javascript
const config = loadConfig()
  .with({ sampling: { maxSampleSize: 5000 } })
  .validate();
```

### 4. Observer Pattern

Structured logging acts as observer:

```javascript
logger.info({ operation, duration }, 'Operation completed');
```

## Error Handling Strategy

### 1. Retry for Transient Errors

```javascript
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    return await operation();
  } catch (error) {
    if (!isRetryable(error) || attempt === maxRetries) throw error;
    await backoff(attempt);
  }
}
```

### 2. Fail Fast for Configuration Errors

```javascript
const config = ConfigSchema.parse(input); // Throws on invalid config
```

### 3. Graceful Degradation

```javascript
try {
  const gitCommit = execSync('git rev-parse HEAD');
  metadata.codeVersion = gitCommit;
} catch {
  metadata.codeVersion = 'unknown'; // Graceful fallback
}
```

### 4. Validation Reports

```javascript
const violations = [];
// Collect all violations
if (violations.length > 0 && config.failOnViolation) {
  throw new Error('Validation failed');
}
```

## Testing Strategy

### Unit Tests
- Pure functions tested in isolation
- Mock dependencies (logger, config)
- Property-based testing for statistical methods

### Integration Tests
- Test component interactions
- Mock external APIs
- Verify data flow

### Regression Tests
- Golden dataset comparisons
- Invariant enforcement
- Output format stability

## Performance Considerations

### Memory

- Streaming for large datasets (future)
- Pagination to control memory
- Garbage collection-friendly data structures

### CPU

- Statistical calculations optimized
- Avoid redundant computations
- Parallel block analysis (future)

### I/O

- Batch API requests
- Rate limiting to avoid overload
- Async I/O for file operations

## Security Considerations

### API Credentials

- Environment variables preferred
- File-based fallback (not committed)
- No hardcoded secrets

### PII Protection

- Automatic detection
- Optional redaction
- Privacy reporting

### Input Validation

- Schema validation on all inputs
- Sanitize user inputs
- Prevent injection attacks

## Extensibility Points

### Adding New Collectors

```javascript
class CustomCollector {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  async fetchData(params) {
    // Custom implementation
  }
}
```

### Adding New Analyzers

```javascript
class SentimentAnalyzer {
  analyze(posts) {
    // Custom analysis
  }
}
```

### Adding New Output Formats

```javascript
async writeParquet(dir, filename, data) {
  // Parquet implementation
}
```

### Adding New Invariants

```javascript
validateCustomInvariant(data) {
  if (condition) {
    this.addViolation('custom', 'message', details);
  }
}
```

## Future Enhancements

1. **Streaming Architecture**: Process data in batches for memory efficiency
2. **Parallel Processing**: Worker threads for block analysis
3. **Caching Layer**: Redis for API response caching
4. **Real-time Monitoring**: Prometheus metrics export
5. **Distributed Tracing**: OpenTelemetry integration
6. **Machine Learning**: Anomaly detection, clustering
7. **Graph Database**: Network analysis of content relationships
8. **Time Series DB**: Long-term trend storage and querying
