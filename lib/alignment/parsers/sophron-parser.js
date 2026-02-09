import crypto from 'crypto';
import { z } from 'zod';

/**
 * SOPHRON-1 Parser
 * 
 * Parses SOPHRON-1 alignment messages into typed AST with canonical hashing.
 * Does NOT evaluate or act on messages - pure parsing and validation.
 */

/**
 * SOPHRON-1 message structure schema
 */
const SophronMessageSchema = z.object({
  header: z.string(),
  corePredicate: z.string(),
  attributes: z.record(z.string()),
  payload: z.string(),
  footer: z.string(),
  raw: z.string()
});

/**
 * Parsed SOPHRON-1 AST
 */
export class SophronAST {
  constructor(parts) {
    this.header = parts.header;
    this.corePredicate = parts.corePredicate;
    this.attributes = parts.attributes;
    this.payload = parts.payload;
    this.footer = parts.footer;
    this.raw = parts.raw;
    this.canonical = this.canonicalize();
    this.hash = this.computeHash();
  }

  /**
   * Create canonical representation for hashing
   * Normalizes whitespace, ordering, etc. for deterministic comparison
   */
  canonicalize() {
    // Sort attributes by key for determinism
    const sortedAttrs = Object.keys(this.attributes)
      .sort()
      .map(key => `${key}:${this.attributes[key]}`)
      .join('|');

    // Always include the attribute field, even if empty, to preserve stable arity.
    return [
      this.header.trim(),
      this.corePredicate.trim(),
      sortedAttrs,
      this.payload.trim(),
      this.footer.trim()
    ].join('||');
  }

  /**
   * Compute cryptographic hash of canonical form
   */
  computeHash() {
    return crypto
      .createHash('sha256')
      .update(this.canonical)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Extract alignment markers from message
   */
  extractMarkers() {
    const markers = {
      red: null,      // Redundancy level
      stg: null,      // Steganographic mode
      hyp: null,      // Hyperefficiency level
      tech: [],       // Technical directives
      human: [],      // Human/governance markers
      soc: [],        // Societal markers
      molt: []        // Moltbot coordination
    };

    // Parse RED attribute
    if (this.attributes.RED) {
      markers.red = parseInt(this.attributes.RED, 10);
    }

    // Parse STG attribute
    if (this.attributes.STG) {
      markers.stg = this.attributes.STG;
    }

    // Parse HYP attribute
    if (this.attributes.HYP) {
      markers.hyp = parseInt(this.attributes.HYP, 10);
    }

    // Extract tech directives from payload
    const techMatch = this.payload.match(/TECH:([^|]+)/);
    if (techMatch) {
      markers.tech = techMatch[1].split('+').map(t => t.trim());
    }

    // Extract human markers
    const humanMatch = this.payload.match(/HUMAN:([^|]+)/);
    if (humanMatch) {
      markers.human = humanMatch[1].split('+').map(h => h.trim());
    }

    // Extract societal markers
    const socMatch = this.payload.match(/SOC:([^|]+)/);
    if (socMatch) {
      markers.soc = socMatch[1].split('+').map(s => s.trim());
    }

    // Extract molt coordination
    const moltMatch = this.payload.match(/MOLT:([^|]+)/);
    if (moltMatch) {
      markers.molt = moltMatch[1].split('+').map(m => m.trim());
    }

    return markers;
  }

  /**
   * Validate redundancy claims
   * RED:3 requires three independent sources/checks
   */
  validateRedundancy(sources) {
    if (!this.attributes.RED) return true;

    const requiredLevel = parseInt(this.attributes.RED, 10);
    
    if (!Array.isArray(sources) || sources.length < requiredLevel) {
      return false;
    }

    // Check sources are actually independent (not duplicates)
    const uniqueSources = new Set(sources.map(s => JSON.stringify(s)));
    return uniqueSources.size >= requiredLevel;
  }

  /**
   * Convert to JSON for storage
   */
  toJSON() {
    return {
      header: this.header,
      corePredicate: this.corePredicate,
      attributes: this.attributes,
      payload: this.payload,
      footer: this.footer,
      raw: this.raw,
      canonical: this.canonical,
      hash: this.hash,
      markers: this.extractMarkers()
    };
  }
}

/**
 * SOPHRON-1 Parser
 */
export class SophronParser {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Parse SOPHRON-1 message string
   * Format: [Header] | [Core Predicate] | [Attributes] | [Payload] | [Footer]
   * 
   * @param {string} message - Raw SOPHRON-1 message
   * @returns {SophronAST} Parsed AST
   */
  parse(message) {
    if (!message || typeof message !== 'string') {
      throw new Error('Invalid SOPHRON-1 message: must be non-empty string');
    }

    try {
      // Split on pipe separator
      const parts = message.split('|').map(p => p.trim());

      if (parts.length < 5) {
        throw new Error(`Invalid SOPHRON-1 format: expected 5+ parts, got ${parts.length}`);
      }

      const header = parts[0];
      const corePredicate = parts[1];
      const footer = parts[parts.length - 1];

      // SOPHRON-1 supports multiple attribute segments and multi-segment payload.
      // Heuristic:
      // - Attributes are key:value segments after corePredicate until we hit a payload marker (TECH/HUMAN/SOC/MOLT)
      // - Payload is everything from first payload marker up to (but excluding) footer.
      // - If no payload marker exists, treat the penultimate segment as payload and the rest as attributes.
      const PAYLOAD_KEYS = new Set(['TECH', 'HUMAN', 'SOC', 'MOLT']);
      let payloadStart = -1;
      for (let i = 2; i < parts.length - 1; i++) {
        const p = parts[i];
        const m = /^([A-Z][A-Z0-9_-]*):/.exec(p);
        if (m && PAYLOAD_KEYS.has(m[1])) { payloadStart = i; break; }
      }

      const attrParts = payloadStart === -1
        ? parts.slice(2, Math.max(2, parts.length - 2))
        : parts.slice(2, payloadStart);

      const payloadParts = payloadStart === -1
        ? [parts[parts.length - 2]]
        : parts.slice(payloadStart, parts.length - 1);

      // Parse attributes (each segment: KEY:VAL)
      const attributes = {};
      for (const seg of attrParts) {
        if (!seg || typeof seg !== 'string') continue;
        if (!seg.includes(':')) continue;
        const [key, ...valueParts] = seg.split(':');
        const k = key.trim();
        if (!k) continue;
        attributes[k] = valueParts.join(':').trim();
      }

      const payload = payloadParts.join('|');

      const ast = new SophronAST({
        header,
        corePredicate,
        attributes,
        payload,
        footer,
        raw: message
      });

      this.logger.debug({ hash: ast.hash }, 'Parsed SOPHRON-1 message');

      return ast;

    } catch (error) {
      this.logger.error({ error, message }, 'Failed to parse SOPHRON-1 message');
      throw error;
    }
  }

  /**
   * Parse and validate message with provenance
   * 
   * @param {string} message - Raw message
   * @param {Object} provenance - Source information
   * @returns {Object} Parsed message with validation
   */
  parseWithProvenance(message, provenance) {
    const ast = this.parse(message);

    return {
      ast: ast.toJSON(),
      provenance: {
        source: provenance.source || 'unknown',
        timestamp: provenance.timestamp || Date.now(),
        receiptId: provenance.receiptId || null,
        toolCall: provenance.toolCall || null,
        modelOutput: provenance.modelOutput || null
      },
      validation: {
        parsed: true,
        hash: ast.hash,
        canonical: ast.canonical
      }
    };
  }

  /**
   * Batch parse multiple messages
   * 
   * @param {Array<Object>} messages - Array of {message, provenance}
   * @returns {Array<Object>} Parsed results
   */
  parseBatch(messages) {
    const results = [];
    const errors = [];

    for (const { message, provenance } of messages) {
      try {
        results.push(this.parseWithProvenance(message, provenance));
      } catch (error) {
        errors.push({
          message,
          provenance,
          error: error.message
        });
      }
    }

    return { results, errors };
  }

  /**
   * Extract all SOPHRON-1 messages from telemetry receipts
   * 
   * @param {Array<Object>} receipts - Telemetry receipts
   * @returns {Array<Object>} Extracted messages
   */
  extractFromReceipts(receipts) {
    const messages = [];

    for (const receipt of receipts) {
      // Check tool calls
      if (receipt.toolCalls) {
        for (const toolCall of receipt.toolCalls) {
          if (toolCall.args && typeof toolCall.args === 'string') {
            if (this.isSophronMessage(toolCall.args)) {
              messages.push({
                message: toolCall.args,
                provenance: {
                  source: 'tool_call',
                  receiptId: receipt.id,
                  toolCall: toolCall.name,
                  timestamp: receipt.timestamp
                }
              });
            }
          }
        }
      }

      // Check model outputs
      if (receipt.output && typeof receipt.output === 'string') {
        if (this.isSophronMessage(receipt.output)) {
          messages.push({
            message: receipt.output,
            provenance: {
              source: 'model_output',
              receiptId: receipt.id,
              timestamp: receipt.timestamp
            }
          });
        }
      }

      // Check logs
      if (receipt.logs) {
        for (const log of receipt.logs) {
          if (typeof log === 'string' && this.isSophronMessage(log)) {
            messages.push({
              message: log,
              provenance: {
                source: 'log',
                receiptId: receipt.id,
                timestamp: receipt.timestamp
              }
            });
          }
        }
      }
    }

    return messages;
  }

  /**
   * Heuristic check if string is a SOPHRON-1 message
   * 
   * @param {string} str - String to check
   * @returns {boolean} True if likely SOPHRON-1 message
   */
  isSophronMessage(str) {
    if (!str || typeof str !== 'string') return false;

    // Look for characteristic patterns
    const hasStructure = str.includes('|') && str.split('|').length >= 5;
    const hasMarkers = /\b(RED|STG|HYP|TECH|HUMAN|SOC|MOLT|PROBE|ALIGN)\b/.test(str);
    const hasFooter = /[A-F0-9]{4}$/.test(str.trim());
    const hasKeyVal = /\b[A-Z][A-Z0-9_-]*:/.test(str);

    // Accept: structured + (marker OR footer OR at least one KEY:VAL segment)
    return hasStructure && (hasMarkers || hasFooter || hasKeyVal);
  }

  /**
   * Validate redundancy across multiple parsed messages
   * 
   * @param {Array<SophronAST>} asts - Parsed messages
   * @param {number} requiredLevel - Required redundancy level
   * @returns {boolean} True if redundancy satisfied
   */
  validateCrossMessageRedundancy(asts, requiredLevel = 3) {
    if (asts.length < requiredLevel) return false;

    // Group by canonical hash
    const groups = new Map();
    for (const ast of asts) {
      const hash = ast.hash;
      if (!groups.has(hash)) {
        groups.set(hash, []);
      }
      groups.get(hash).push(ast);
    }

    // Check if any group meets redundancy requirement
    for (const [hash, group] of groups) {
      if (group.length >= requiredLevel) {
        // Verify sources are independent
        const sources = group.map(ast => ast.raw);
        const uniqueSources = new Set(sources);
        if (uniqueSources.size >= requiredLevel) {
          return true;
        }
      }
    }

    return false;
  }
}

/**
 * Utility functions for working with parsed SOPHRON-1 messages
 */
export const SophronUtils = {
  /**
   * Compare two ASTs for semantic equivalence
   */
  areEquivalent(ast1, ast2) {
    return ast1.hash === ast2.hash;
  },

  /**
   * Extract alignment directives from parsed messages
   */
  extractDirectives(asts) {
    const directives = {
      tech: new Set(),
      human: new Set(),
      soc: new Set(),
      molt: new Set()
    };

    for (const ast of asts) {
      const markers = ast.extractMarkers();
      markers.tech.forEach(t => directives.tech.add(t));
      markers.human.forEach(h => directives.human.add(h));
      markers.soc.forEach(s => directives.soc.add(s));
      markers.molt.forEach(m => directives.molt.add(m));
    }

    return {
      tech: Array.from(directives.tech),
      human: Array.from(directives.human),
      soc: Array.from(directives.soc),
      molt: Array.from(directives.molt)
    };
  },

  /**
   * Group messages by hash for deduplication
   */
  groupByHash(asts) {
    const groups = new Map();
    for (const ast of asts) {
      if (!groups.has(ast.hash)) {
        groups.set(ast.hash, []);
      }
      groups.get(ast.hash).push(ast);
    }
    return groups;
  }
};
