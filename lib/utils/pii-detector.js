/**
 * PII Detector for redacting sensitive information
 */
export class PiiDetector {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    
    // Regex patterns for common PII
    this.patterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      url: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
      apiKey: /\b[A-Za-z0-9]{32,}\b/g // Simple pattern for long alphanumeric strings
    };
  }

  /**
   * Detect PII in text
   * @param {string} text - Text to scan
   * @returns {Object} Detection results
   */
  detect(text) {
    if (!text || typeof text !== 'string') {
      return { hasPii: false, types: [] };
    }

    const detected = [];

    for (const [type, pattern] of Object.entries(this.patterns)) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        detected.push({
          type,
          count: matches.length,
          samples: matches.slice(0, 3) // Keep first 3 for logging
        });
      }
    }

    return {
      hasPii: detected.length > 0,
      types: detected
    };
  }

  /**
   * Redact PII from text
   * @param {string} text - Text to redact
   * @param {Object} options - Redaction options
   * @returns {string} Redacted text
   */
  redact(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    const { 
      placeholder = '[REDACTED]',
      preserveLength = false 
    } = options;

    let redacted = text;

    for (const [type, pattern] of Object.entries(this.patterns)) {
      redacted = redacted.replace(pattern, (match) => {
        if (preserveLength) {
          return '*'.repeat(match.length);
        }
        return `${placeholder}:${type}`;
      });
    }

    return redacted;
  }

  /**
   * Scan object for PII recursively
   * @param {*} obj - Object to scan
   * @param {Array} path - Current path in object
   * @returns {Array} Array of PII findings
   */
  scanObject(obj, path = []) {
    const findings = [];

    if (obj === null || obj === undefined) {
      return findings;
    }

    if (typeof obj === 'string') {
      const detection = this.detect(obj);
      if (detection.hasPii) {
        findings.push({
          path: path.join('.'),
          ...detection
        });
      }
      return findings;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        findings.push(...this.scanObject(item, [...path, `[${index}]`]));
      });
      return findings;
    }

    if (typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        findings.push(...this.scanObject(value, [...path, key]));
      }
    }

    return findings;
  }

  /**
   * Redact PII from object recursively
   * @param {*} obj - Object to redact
   * @param {Object} options - Redaction options
   * @returns {*} Redacted object
   */
  redactObject(obj, options = {}) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.redact(obj, options);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.redactObject(item, options));
    }

    if (typeof obj === 'object') {
      const redacted = {};
      for (const [key, value] of Object.entries(obj)) {
        redacted[key] = this.redactObject(value, options);
      }
      return redacted;
    }

    return obj;
  }

  /**
   * Generate PII scan report
   * @param {Array} findings - PII findings
   * @returns {Object} Report
   */
  generateReport(findings) {
    const typeCount = {};
    
    for (const finding of findings) {
      for (const type of finding.types) {
        if (!typeCount[type.type]) {
          typeCount[type.type] = 0;
        }
        typeCount[type.type] += type.count;
      }
    }

    return {
      totalFindings: findings.length,
      totalInstances: Object.values(typeCount).reduce((sum, count) => sum + count, 0),
      byType: typeCount,
      findings: findings.map(f => ({
        path: f.path,
        types: f.types.map(t => t.type)
      }))
    };
  }

  /**
   * Scan and log PII in data
   * @param {*} data - Data to scan
   * @param {string} label - Label for logging
   * @returns {boolean} True if PII found
   */
  scanAndLog(data, label = 'data') {
    if (!this.config.privacy.enablePiiDetection) {
      return false;
    }

    const findings = this.scanObject(data);

    if (findings.length > 0) {
      const report = this.generateReport(findings);
      this.logger.warn({ label, report }, 'PII detected in data');
      return true;
    }

    this.logger.debug({ label }, 'No PII detected');
    return false;
  }
}
