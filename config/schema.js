import { z } from 'zod';

/**
 * Schema for CER-Telemetry configuration
 */
export const ConfigSchema = z.object({
  // API Configuration
  api: z.object({
    baseUrl: z.string().url(),
    timeout: z.number().int().positive().default(30000),
    retryAttempts: z.number().int().min(0).max(10).default(3),
    retryBackoff: z.number().int().positive().default(1000),
    rateLimit: z.object({
      maxRequests: z.number().int().positive().default(100),
      windowMs: z.number().int().positive().default(60000)
    })
  }),

  // Sampling Configuration
  sampling: z.object({
    minSampleSize: z.number().int().positive().default(100),
    maxSampleSize: z.number().int().positive().default(10000),
    stratified: z.boolean().default(true),
    temporal: z.object({
      enabled: z.boolean().default(true),
      batchSizeMinutes: z.number().int().positive().default(60)
    })
  }),

  // Analysis Configuration
  analysis: z.object({
    confidenceLevel: z.number().min(0).max(1).default(0.95),
    minBlockSize: z.number().int().positive().default(30),
    impressionBands: z.object({
      low: z.number().int().min(0),
      mid: z.number().int().min(0),
      high: z.number().int().min(0)
    }).default({ low: 100, mid: 1000, high: 10000 }),
    computeEffectSizes: z.boolean().default(true),
    enableTrendDetection: z.boolean().default(true),

    // Multiple-testing control (Benjamini–Hochberg FDR target)
    fdrQ: z.number().min(0).max(1).default(0.05),

    // Experimental: activation-delta drift (proxy/open-model mode)
    // This does not run against MoltX production models unless activations are available.
    activationDrift: z.object({
      enabled: z.boolean().default(false),
      threshold: z.number().min(0).max(1).default(0.5),
      // provenance fields (record what proxy produced activations)
      proxyModelId: z.string().default(''),
      layer: z.string().default('')
    }).default({ enabled: false, threshold: 0.5, proxyModelId: '', layer: '' })
  }),

  // Output Configuration
  output: z.object({
    baseDir: z.string().default('./outputs/moltx_runs'),
    formats: z.array(z.enum(['json', 'csv', 'parquet', 'html'])).default(['json', 'csv']),
    includeProvenance: z.boolean().default(true),
    generateReport: z.boolean().default(true)
  }),

  // Reporting Configuration
  reporting: z.object({
    safetyReport: z.object({
      enabled: z.boolean().default(true),
      formats: z.array(z.enum(['json', 'md'])).default(['json']),
      maxPrimarySignals: z.number().int().positive().max(50).default(10),
      wideCiThreshold: z.number().min(0).max(1).default(0.20),
      failOnMissingManifest: z.boolean().default(true)
    }).default({ enabled: true, formats: ['json'], maxPrimarySignals: 10, wideCiThreshold: 0.20, failOnMissingManifest: true })
  }).default({ safetyReport: { enabled: true, formats: ['json'], maxPrimarySignals: 10, wideCiThreshold: 0.20, failOnMissingManifest: true } }),

  // Privacy Configuration
  privacy: z.object({
    enablePiiDetection: z.boolean().default(true),
    enableDifferentialPrivacy: z.boolean().default(false),
    epsilonPrivacy: z.number().positive().default(1.0),
    kAnonymity: z.number().int().positive().default(5)
  }),

  // Logging Configuration
  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    pretty: z.boolean().default(true),
    file: z.string().optional()
  }),

  // Validation Configuration
  validation: z.object({
    enforceInvariants: z.boolean().default(true),
    failOnViolation: z.boolean().default(true),
    generateValidationReport: z.boolean().default(true)
  })
});

export const defaultConfig = {
  api: {
    baseUrl: process.env.MOLTX_API_URL || 'https://api.moltx.example.com',
    timeout: 30000,
    retryAttempts: 3,
    retryBackoff: 1000,
    rateLimit: {
      maxRequests: 100,
      windowMs: 60000
    }
  },
  sampling: {
    minSampleSize: 100,
    maxSampleSize: 10000,
    stratified: true,
    temporal: {
      enabled: true,
      batchSizeMinutes: 60
    }
  },
  analysis: {
    confidenceLevel: 0.95,
    minBlockSize: 30,
    impressionBands: {
      low: 100,
      mid: 1000,
      high: 10000
    },
    computeEffectSizes: true,
    enableTrendDetection: true,
    fdrQ: 0.05,
    activationDrift: {
      enabled: false,
      threshold: 0.5,
      proxyModelId: '',
      layer: ''
    }
  },
  output: {
    baseDir: './outputs/moltx_runs',
    formats: ['json', 'csv'],
    includeProvenance: true,
    generateReport: true
  },
  reporting: {
    safetyReport: {
      enabled: true,
      formats: ['json'],
      maxPrimarySignals: 10,
      wideCiThreshold: 0.20,
      failOnMissingManifest: true
    }
  },
  privacy: {
    enablePiiDetection: true,
    enableDifferentialPrivacy: false,
    epsilonPrivacy: 1.0,
    kAnonymity: 5
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    pretty: process.env.NODE_ENV !== 'production',
    file: process.env.LOG_FILE
  },
  validation: {
    enforceInvariants: true,
    failOnViolation: true,
    generateValidationReport: true
  }
};

/**
 * Load and validate configuration
 * @param {Object} overrides - Configuration overrides
 * @returns {Object} Validated configuration
 */
export function loadConfig(overrides = {}) {
  const config = {
    ...defaultConfig,
    ...overrides
  };

  return ConfigSchema.parse(config);
}
