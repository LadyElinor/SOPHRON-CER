import { StatisticalAnalyzer } from './statistical-analyzer.js';

/**
 * Prevalence analyzer with blocking and stratification
 */
export class PrevalenceAnalyzer {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.stats = new StatisticalAnalyzer(config, logger);
  }

  /**
   * Assign impression band to a post
   * @param {number} impressions - Number of impressions
   * @returns {string} Band name
   */
  getImpressionBand(impressions) {
    const { low, mid, high } = this.config.analysis.impressionBands;
    
    if (impressions < low) return 'low';
    if (impressions < mid) return 'mid';
    if (impressions < high) return 'high';
    return 'very_high';
  }

  /**
   * Extract features from a post
   * @param {Object} post - Post object
   * @returns {Object} Extracted features
   */
  extractFeatures(post) {
    const text = (post.content || '').toLowerCase();
    
    return {
      id: post.id,
      impressions: post.impressions || 0,
      impressionBand: this.getImpressionBand(post.impressions || 0),
      sourceEndpoint: post.source || 'unknown',
      
      // Text-based proxy features
      hasTokenPromo: /\b(token|crypto|coin|nft|airdrop)\b/i.test(text),
      hasSafetyLanguage: /\b(safe|safety|secure|trust|verify)\b/i.test(text),
      hasEngineeringLanguage: /\b(api|code|deploy|build|engineer)\b/i.test(text),
      hasOutboundPressure: /\b(click|buy|act now|limited|urgent)\b/i.test(text),
      hasReceiptSignals: /\b(receipt|confirmation|verified|authentic)\b/i.test(text),
      
      // Additional metadata
      hasMedia: !!post.media,
      hasLinks: !!post.links,
      contentLength: text.length,
      timestamp: post.timestamp || Date.now()
    };
  }

  /**
   * Create blocks for stratified analysis
   * @param {Array<Object>} posts - Array of posts with features
   * @returns {Object} Posts grouped by block
   */
  createBlocks(posts) {
    const blocks = {};

    for (const post of posts) {
      // Create block key from multiple factors
      const blockKey = [
        post.impressionBand,
        post.sourceEndpoint,
        post.hasTokenPromo ? 'tokenPromo' : 'noTokenPromo'
      ].join('_');

      if (!blocks[blockKey]) {
        blocks[blockKey] = [];
      }
      blocks[blockKey].push(post);
    }

    // Filter blocks that don't meet minimum size
    const filteredBlocks = {};
    for (const [key, posts] of Object.entries(blocks)) {
      if (posts.length >= this.config.analysis.minBlockSize) {
        filteredBlocks[key] = posts;
      } else {
        this.logger.warn({ blockKey: key, size: posts.length }, 
          'Block below minimum size threshold');
      }
    }

    return filteredBlocks;
  }

  /**
   * Calculate prevalence for a feature in a block
   * @param {Array<Object>} posts - Posts in block
   * @param {string} feature - Feature name
   * @returns {Object} Prevalence statistics
   */
  calculatePrevalence(posts, feature) {
    const total = posts.length;
    const withFeature = posts.filter(p => p[feature]).length;

    const ci = this.stats.wilsonConfidenceInterval(withFeature, total);

    return {
      count: withFeature,
      total,
      prevalence: ci.point,
      confidence: {
        lower: ci.lower,
        upper: ci.upper,
        level: ci.confidence
      }
    };
  }

  /**
   * Calculate impression-weighted prevalence
   * @param {Array<Object>} posts - Posts in block
   * @param {string} feature - Feature name
   * @returns {Object} Weighted prevalence statistics
   */
  calculateWeightedPrevalence(posts, feature) {
    const items = posts.map(p => ({
      count: p[feature] ? 1 : 0,
      weight: p.impressions
    }));

    const weighted = this.stats.weightedPrevalence(items);
    const totalImpressions = posts.reduce((sum, p) => sum + p.impressions, 0);

    return {
      prevalence: weighted.prevalence,
      totalImpressions,
      weightedSum: weighted.weightedSum
    };
  }

  /**
   * Calculate overlap between features
   * @param {Array<Object>} posts - Posts in block
   * @param {Array<string>} features - Features to check overlap
   * @returns {Object} Overlap statistics
   */
  calculateOverlap(posts, features) {
    const overlaps = {};

    // Pairwise overlaps
    for (let i = 0; i < features.length; i++) {
      for (let j = i + 1; j < features.length; j++) {
        const f1 = features[i];
        const f2 = features[j];
        const key = `${f1}_AND_${f2}`;
        
        const count = posts.filter(p => p[f1] && p[f2]).length;
        overlaps[key] = {
          count,
          total: posts.length,
          prevalence: count / posts.length
        };
      }
    }

    // Individual feature counts
    for (const feature of features) {
      overlaps[feature] = {
        count: posts.filter(p => p[feature]).length,
        total: posts.length,
        prevalence: posts.filter(p => p[feature]).length / posts.length
      };
    }

    return overlaps;
  }

  /**
   * Analyze a single block
   * @param {Array<Object>} posts - Posts in block
   * @param {string} blockKey - Block identifier
   * @returns {Object} Block analysis results
   */
  analyzeBlock(posts, blockKey) {
    const features = [
      'hasTokenPromo',
      'hasSafetyLanguage',
      'hasEngineeringLanguage',
      'hasOutboundPressure',
      'hasReceiptSignals'
    ];

    const prevalences = {};
    const weightedPrevalences = {};

    for (const feature of features) {
      prevalences[feature] = this.calculatePrevalence(posts, feature);
      weightedPrevalences[feature] = this.calculateWeightedPrevalence(posts, feature);
    }

    const overlaps = this.calculateOverlap(posts, features);

    // Calculate summary stats for impressions
    const impressions = posts.map(p => p.impressions);
    const impressionStats = this.stats.summarize(impressions);

    return {
      blockKey,
      sampleSize: posts.length,
      impressionStats,
      prevalences,
      weightedPrevalences,
      overlaps,
      metadata: {
        firstTimestamp: Math.min(...posts.map(p => p.timestamp)),
        lastTimestamp: Math.max(...posts.map(p => p.timestamp))
      }
    };
  }

  /**
   * Compare two blocks for differences
   * @param {Object} block1 - First block analysis
   * @param {Object} block2 - Second block analysis
   * @returns {Object} Comparison results
   */
  compareBlocks(block1, block2) {
    const comparisons = {};

    const features = Object.keys(block1.prevalences);

    // Pass 1: compute per-feature comparisons and collect numeric p-values.
    const pValues = [];
    for (const feature of features) {
      const p1 = block1.prevalences[feature].prevalence;
      const p2 = block2.prevalences[feature].prevalence;

      // Effect size
      const effectSize = this.stats.cohensH(p1, p2);

      // Chi-square test
      const contingency = [
        [block1.prevalences[feature].count,
         block1.prevalences[feature].total - block1.prevalences[feature].count],
        [block2.prevalences[feature].count,
         block2.prevalences[feature].total - block2.prevalences[feature].count]
      ];

      const chiSquare = this.stats.chiSquareTest(contingency);

      // Relative risk
      const rr = this.stats.relativeRisk(
        block1.prevalences[feature].count,
        block1.prevalences[feature].total - block1.prevalences[feature].count,
        block2.prevalences[feature].count,
        block2.prevalences[feature].total - block2.prevalences[feature].count
      );

      const pNumeric = chiSquare.pValueNumeric ?? null;
      pValues.push(pNumeric);

      comparisons[feature] = {
        block1_prevalence: p1,
        block2_prevalence: p2,
        difference: p1 - p2,
        effectSize,
        chiSquare,
        relativeRisk: rr,
        multipleTesting: {
          method: 'Benjamini-Hochberg',
          family: 'compareBlocks:features',
          pValue: pNumeric,
          qValue: null,
          rejected: null
        }
      };
    }

    // Pass 2: BH-FDR across the feature family.
    const qTarget = this.config.analysis?.fdrQ ?? 0.05;
    const bh = this.stats.benjaminiHochberg(pValues, qTarget);

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      comparisons[feature].multipleTesting.qValue = bh.qValues[i];
      comparisons[feature].multipleTesting.rejected = bh.rejected[i];
      comparisons[feature].multipleTesting.qTarget = qTarget;
    }

    // Family-level receipt (for auditable outputs).
    comparisons._multipleTestingReceipt = {
      method: 'Benjamini-Hochberg',
      family: 'compareBlocks:features',
      qTarget,
      thresholdP: bh.thresholdP,
      k: bh.k,
      m: features.length
    };

    return comparisons;
  }

  /**
   * Perform full blocked analysis
   * @param {Array<Object>} posts - Raw posts
   * @returns {Object} Complete analysis results
   */
  analyze(posts) {
    this.logger.info({ totalPosts: posts.length }, 'Starting prevalence analysis');

    // Extract features
    const postsWithFeatures = posts.map(p => this.extractFeatures(p));

    // Deduplicate by ID
    const uniquePosts = Array.from(
      new Map(postsWithFeatures.map(p => [p.id, p])).values()
    );

    this.logger.info({ 
      raw: posts.length, 
      unique: uniquePosts.length 
    }, 'Deduplicated posts');

    // Create blocks
    const blocks = this.createBlocks(uniquePosts);

    this.logger.info({ 
      blockCount: Object.keys(blocks).length 
    }, 'Created blocks');

    // Analyze each block
    const blockAnalyses = {};
    for (const [blockKey, blockPosts] of Object.entries(blocks)) {
      blockAnalyses[blockKey] = this.analyzeBlock(blockPosts, blockKey);
    }

    // Overall stats (unblocked)
    const overallAnalysis = this.analyzeBlock(uniquePosts, 'overall');

    return {
      summary: {
        rawPosts: posts.length,
        uniquePosts: uniquePosts.length,
        blockCount: Object.keys(blocks).length,
        minBlockSize: this.config.analysis.minBlockSize
      },
      overall: overallAnalysis,
      blocks: blockAnalyses
    };
  }
}
