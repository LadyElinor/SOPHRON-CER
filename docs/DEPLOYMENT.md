# Deployment & Operations Guide

Production deployment and operational best practices for CER-Telemetry v2.0.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Options](#deployment-options)
3. [Configuration Management](#configuration-management)
4. [Monitoring & Alerting](#monitoring--alerting)
5. [Backup & Recovery](#backup--recovery)
6. [Performance Tuning](#performance-tuning)
7. [Security Hardening](#security-hardening)
8. [Troubleshooting](#troubleshooting)

## Pre-Deployment Checklist

### Infrastructure Requirements

- [ ] Node.js 18+ installed
- [ ] Sufficient disk space (estimate: 100MB per run)
- [ ] Network access to MoltX API
- [ ] Log directory with write permissions
- [ ] Backup storage configured

### Security Requirements

- [ ] API tokens stored securely (env vars or secrets manager)
- [ ] TLS/SSL certificates configured
- [ ] Firewall rules configured
- [ ] Log rotation enabled
- [ ] PII detection enabled

### Testing Requirements

- [ ] Unit tests passing (`npm test`)
- [ ] Integration tests with staging API
- [ ] Dry-run successful
- [ ] Validation passing on test data
- [ ] Performance benchmarks met

## Deployment Options

### Option 1: Single Server

**Best for**: Small teams, development, staging

```bash
# 1. Clone repository
git clone <repo-url> /opt/cer-telemetry
cd /opt/cer-telemetry

# 2. Install dependencies
npm install --production

# 3. Configure environment
cp .env.example .env
vim .env  # Add API token

# 4. Create systemd service
sudo cp deploy/systemd/cer-telemetry.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cer-telemetry
sudo systemctl start cer-telemetry

# 5. Verify
sudo systemctl status cer-telemetry
sudo journalctl -u cer-telemetry -f
```

**Systemd Service File** (`deploy/systemd/cer-telemetry.service`):
```ini
[Unit]
Description=CER-Telemetry Analysis Service
After=network.target

[Service]
Type=oneshot
User=cer-telemetry
Group=cer-telemetry
WorkingDirectory=/opt/cer-telemetry
EnvironmentFile=/opt/cer-telemetry/.env
ExecStart=/usr/bin/node src/cli.js analyze
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cer-telemetry

[Install]
WantedBy=multi-user.target
```

**Systemd Timer** (`deploy/systemd/cer-telemetry.timer`):
```ini
[Unit]
Description=CER-Telemetry Daily Analysis Timer

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
```

### Option 2: Docker Container

**Best for**: Consistent environments, cloud deployments

**Dockerfile**:
```dockerfile
FROM node:18-alpine

# Install dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --production

# Copy application
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S cer && \
    adduser -u 1001 -S cer -G cer && \
    mkdir -p /app/outputs && \
    chown -R cer:cer /app

USER cer

# Run
CMD ["node", "src/cli.js", "analyze"]
```

**Build and Run**:
```bash
# Build
docker build -t cer-telemetry:2.0 .

# Run with environment file
docker run --env-file .env \
  -v $(pwd)/outputs:/app/outputs \
  cer-telemetry:2.0

# Run with Docker Compose
docker-compose up -d
```

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  cer-telemetry:
    build: .
    container_name: cer-telemetry
    env_file: .env
    volumes:
      - ./outputs:/app/outputs
      - ./logs:/app/logs
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Option 3: Kubernetes

**Best for**: Large-scale, high-availability deployments

**Deployment** (`deploy/k8s/deployment.yaml`):
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cer-telemetry
  namespace: analytics
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cer-telemetry
  template:
    metadata:
      labels:
        app: cer-telemetry
    spec:
      containers:
      - name: cer-telemetry
        image: cer-telemetry:2.0
        env:
        - name: MOLTX_API_TOKEN
          valueFrom:
            secretKeyRef:
              name: cer-secrets
              key: api-token
        volumeMounts:
        - name: outputs
          mountPath: /app/outputs
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
      volumes:
      - name: outputs
        persistentVolumeClaim:
          claimName: cer-outputs-pvc
```

**CronJob** (`deploy/k8s/cronjob.yaml`):
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cer-telemetry-daily
  namespace: analytics
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: cer-telemetry
            image: cer-telemetry:2.0
            command: ["node", "src/cli.js", "analyze"]
            envFrom:
            - secretRef:
                name: cer-secrets
          restartPolicy: OnFailure
```

## Configuration Management

### Environment-Specific Configs

```bash
config/
├── default.json          # Base configuration
├── development.json      # Dev overrides
├── staging.json          # Staging overrides
└── production.json       # Production config
```

**Loading Strategy**:
```javascript
const env = process.env.NODE_ENV || 'development';
const configFile = `config/${env}.json`;
const config = loadConfig(JSON.parse(fs.readFileSync(configFile)));
```

### Secrets Management

**Option A: Environment Variables** (Recommended for cloud)
```bash
export MOLTX_API_TOKEN=$(aws secretsmanager get-secret-value \
  --secret-id cer/api-token --query SecretString --output text)
```

**Option B: Vault/Secrets Manager**
```javascript
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManager({ region: 'us-east-1' });
const secret = await client.getSecretValue({ SecretId: 'cer/api-token' });
process.env.MOLTX_API_TOKEN = secret.SecretString;
```

**Option C: Encrypted Config Files**
```bash
# Encrypt config
openssl enc -aes-256-cbc -salt -in production.json -out production.json.enc

# Decrypt at runtime
openssl enc -aes-256-cbc -d -in production.json.enc -out production.json
```

## Monitoring & Alerting

### Metrics to Monitor

1. **Run Metrics**
   - Success/failure rate
   - Run duration
   - Sample sizes
   - Invariant violations

2. **System Metrics**
   - CPU usage
   - Memory usage
   - Disk I/O
   - Network throughput

3. **API Metrics**
   - Request count
   - Error rate
   - Latency (p50, p95, p99)
   - Rate limit hits

### Prometheus Integration

**Export Metrics**:
```javascript
import client from 'prom-client';

const runDuration = new client.Histogram({
  name: 'cer_run_duration_seconds',
  help: 'Duration of analysis runs',
  buckets: [10, 30, 60, 120, 300, 600]
});

const invariantViolations = new client.Counter({
  name: 'cer_invariant_violations_total',
  help: 'Total invariant violations',
  labelNames: ['invariant']
});
```

**Scrape Endpoint**:
```javascript
import express from 'express';
const app = express();

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

app.listen(9090);
```

### Alerting Rules

**Prometheus Alert Rules**:
```yaml
groups:
- name: cer-telemetry
  rules:
  - alert: HighFailureRate
    expr: rate(cer_runs_failed_total[5m]) > 0.5
    for: 10m
    annotations:
      summary: "High failure rate in CER-Telemetry runs"

  - alert: InvariantViolations
    expr: increase(cer_invariant_violations_total[1h]) > 10
    annotations:
      summary: "Multiple invariant violations detected"

  - alert: LongRunDuration
    expr: cer_run_duration_seconds > 600
    annotations:
      summary: "Analysis run taking too long"
```

### Log Aggregation

**Structured Logs to Elasticsearch**:
```javascript
import { createLogger } from './lib/utils/logger.js';

const logger = createLogger({
  level: 'info',
  pretty: false,
  transport: {
    target: 'pino-elasticsearch',
    options: {
      node: 'http://elasticsearch:9200',
      index: 'cer-telemetry'
    }
  }
});
```

**Kibana Dashboard Queries**:
```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "level": "error" } },
        { "range": { "@timestamp": { "gte": "now-1h" } } }
      ]
    }
  }
}
```

## Backup & Recovery

### What to Backup

1. **Configuration Files**
   - All `config/*.json` files
   - `.env` file (encrypted)

2. **Output Data**
   - All `outputs/moltx_runs/` directories
   - Retention: 90 days minimum

3. **Logs**
   - Application logs
   - System logs
   - Retention: 30 days minimum

### Backup Strategy

**Automated Daily Backups**:
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backup/cer-telemetry"
DATE=$(date +%Y%m%d)

# Backup outputs
tar -czf "$BACKUP_DIR/outputs-$DATE.tar.gz" outputs/

# Backup config (encrypted)
tar -czf - config/ | openssl enc -aes-256-cbc -salt \
  > "$BACKUP_DIR/config-$DATE.tar.gz.enc"

# Upload to S3
aws s3 cp "$BACKUP_DIR/" s3://backups/cer-telemetry/ --recursive

# Cleanup old backups (keep 90 days)
find "$BACKUP_DIR" -name "*.tar.gz*" -mtime +90 -delete
```

**Cron Schedule**:
```bash
0 3 * * * /opt/cer-telemetry/scripts/backup.sh >> /var/log/backup.log 2>&1
```

### Disaster Recovery

**Recovery Procedure**:
```bash
# 1. Restore from backup
aws s3 sync s3://backups/cer-telemetry/latest/ /opt/cer-telemetry-restore/

# 2. Decrypt config
openssl enc -aes-256-cbc -d \
  -in config-20240208.tar.gz.enc -out config.tar.gz

# 3. Extract
tar -xzf outputs-20240208.tar.gz
tar -xzf config.tar.gz

# 4. Verify
node src/cli.js validate <run-id>

# 5. Resume operations
systemctl start cer-telemetry
```

## Performance Tuning

### Node.js Optimization

```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096" node src/cli.js analyze

# Enable production mode
NODE_ENV=production node src/cli.js analyze
```

### Database Query Optimization

For future enhancement with database storage:
```javascript
// Use connection pooling
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Use batch inserts
const batchSize = 1000;
for (let i = 0; i < data.length; i += batchSize) {
  const batch = data.slice(i, i + batchSize);
  await pool.query('INSERT INTO posts VALUES ...', batch);
}
```

### Caching Strategy

```javascript
import Redis from 'ioredis';

const redis = new Redis();

// Cache API responses
async function fetchWithCache(url, ttl = 3600) {
  const cached = await redis.get(url);
  if (cached) return JSON.parse(cached);

  const data = await fetch(url).then(r => r.json());
  await redis.setex(url, ttl, JSON.stringify(data));
  return data;
}
```

## Security Hardening

### Principle of Least Privilege

```bash
# Create dedicated user
sudo useradd -r -s /bin/false cer-telemetry

# Set permissions
sudo chown -R cer-telemetry:cer-telemetry /opt/cer-telemetry
sudo chmod 700 /opt/cer-telemetry/outputs
sudo chmod 600 /opt/cer-telemetry/.env
```

### Network Security

**Firewall Rules**:
```bash
# Allow only necessary outbound connections
sudo ufw allow out 443/tcp comment 'HTTPS to MoltX API'
sudo ufw deny out from any to any
```

### Dependency Security

```bash
# Regular security audits
npm audit
npm audit fix

# Automated updates
npm install -g npm-check-updates
ncu -u
npm install
npm test
```

### Secrets Rotation

```bash
#!/bin/bash
# rotate-secrets.sh

# Generate new API token (manual step in MoltX dashboard)

# Update in secrets manager
aws secretsmanager update-secret \
  --secret-id cer/api-token \
  --secret-string "$NEW_TOKEN"

# Restart service
systemctl restart cer-telemetry

# Verify
journalctl -u cer-telemetry -n 50
```

## Troubleshooting

### Common Issues

#### Issue: "Out of Memory"
```bash
# Check memory usage
free -h
ps aux | grep node

# Solution: Increase Node.js heap
NODE_OPTIONS="--max-old-space-size=8192" node src/cli.js analyze
```

#### Issue: "API Rate Limiting"
```javascript
// Reduce rate in config
{
  "api": {
    "rateLimit": {
      "maxRequests": 30,
      "windowMs": 60000
    }
  }
}
```

#### Issue: "Disk Full"
```bash
# Check disk usage
df -h
du -sh outputs/*

# Clean old runs
find outputs/moltx_runs -type d -mtime +30 -exec rm -rf {} +
```

### Debug Mode

```bash
# Enable verbose logging
node src/cli.js analyze --log-level trace --json | tee debug.log

# Trace API calls
NODE_DEBUG=http node src/cli.js analyze

# Profile performance
node --prof src/cli.js analyze
node --prof-process isolate-*.log > profile.txt
```

### Health Checks

```javascript
// health-check.js
import { MoltxCollector } from './lib/collectors/moltx-collector.js';

async function healthCheck() {
  try {
    const collector = new MoltxCollector(config, logger);
    await collector.initialize();
    console.log('OK');
    process.exit(0);
  } catch (error) {
    console.error('FAIL:', error.message);
    process.exit(1);
  }
}

healthCheck();
```

**Monitor Script**:
```bash
#!/bin/bash
if ! timeout 30 node health-check.js; then
  echo "Health check failed" | mail -s "CER-Telemetry Alert" ops@example.com
  systemctl restart cer-telemetry
fi
```

## Operational Runbook

### Daily Operations

1. **Morning Check** (10 minutes)
   - Check overnight run status
   - Review validation reports
   - Check disk space
   - Review error logs

2. **Weekly Review** (30 minutes)
   - Compare week-over-week trends
   - Review invariant violations
   - Update documentation
   - Plan capacity

3. **Monthly Maintenance** (2 hours)
   - Update dependencies
   - Review and optimize config
   - Backup verification
   - Security audit

### Incident Response

**Severity 1: Service Down**
1. Check systemd status: `systemctl status cer-telemetry`
2. Review recent logs: `journalctl -u cer-telemetry -n 100`
3. Verify API connectivity
4. Restart if needed: `systemctl restart cer-telemetry`
5. Escalate if not resolved in 15 minutes

**Severity 2: Invariant Violations**
1. Review validation report
2. Compare with recent baseline
3. Check for data quality issues
4. Investigate code changes
5. Document findings

**Severity 3: Performance Degradation**
1. Check system resources
2. Review API latency
3. Check database performance (if applicable)
4. Analyze slow queries
5. Optimize if needed

This guide provides a foundation for production operations. Customize based on your infrastructure and requirements.
