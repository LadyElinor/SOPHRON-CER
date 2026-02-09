import fs from 'fs/promises';
import path from 'path';

/**
 * Error class for API errors
 */
export class ApiError extends Error {
  constructor(message, statusCode, isRetryable = false) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
}

/**
 * Rate limiter using token bucket algorithm
 */
class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.tokens = maxRequests;
    this.lastRefill = Date.now();
  }

  async acquire() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    
    // Refill tokens based on elapsed time
    if (elapsed >= this.windowMs) {
      this.tokens = this.maxRequests;
      this.lastRefill = now;
    }

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    // Wait until tokens are available
    const waitTime = this.windowMs - elapsed;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    this.tokens = this.maxRequests - 1;
    this.lastRefill = Date.now();
  }
}

/**
 * MoltX API Collector with retry logic and rate limiting
 */
export class MoltxCollector {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.rateLimiter = new RateLimiter(
      config.api.rateLimit.maxRequests,
      config.api.rateLimit.windowMs
    );
    this.bearerToken = null;
  }

  /**
   * Initialize the collector by loading the API token
   */
  async initialize() {
    try {
      // Try environment variable first
      this.bearerToken = process.env.MOLTX_API_TOKEN;
      
      // Fall back to file if env var not set
      if (!this.bearerToken) {
        const tokenPath = process.env.MOLTX_TOKEN_FILE || 'moltx.txt';
        this.bearerToken = (await fs.readFile(tokenPath, 'utf-8')).trim();
      }

      if (!this.bearerToken) {
        throw new Error('No MoltX API token found. Set MOLTX_API_TOKEN env var or create moltx.txt file');
      }

      this.logger.info('MoltX collector initialized');
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize MoltX collector');
      throw error;
    }
  }

  /**
   * Make an API request with retry logic
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Response data
   */
  async request(endpoint, options = {}) {
    const url = `${this.config.api.baseUrl}${endpoint}`;
    let lastError;

    for (let attempt = 0; attempt <= this.config.api.retryAttempts; attempt++) {
      try {
        await this.rateLimiter.acquire();

        this.logger.debug({ url, attempt }, 'Making API request');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.api.timeout);

        const response = await fetch(url, {
          ...options,
          headers: {
            'Authorization': `Bearer ${this.bearerToken}`,
            'Content-Type': 'application/json',
            ...options.headers
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const isRetryable = response.status >= 500 || response.status === 429;
          throw new ApiError(
            `API request failed: ${response.status} ${response.statusText}`,
            response.status,
            isRetryable
          );
        }

        const data = await response.json();
        this.logger.debug({ url, attempt }, 'API request successful');
        return data;

      } catch (error) {
        lastError = error;

        const isRetryable = error.isRetryable || 
                           error.name === 'AbortError' || 
                           error.code === 'ECONNRESET';

        if (!isRetryable || attempt === this.config.api.retryAttempts) {
          this.logger.error({ url, attempt, error }, 'API request failed permanently');
          throw error;
        }

        const backoffMs = this.config.api.retryBackoff * Math.pow(2, attempt);
        this.logger.warn({ url, attempt, backoffMs, error: error.message }, 'Retrying API request');
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    throw lastError;
  }

  /**
   * Fetch trending posts from MoltX
   * @param {Object} params - Query parameters
   * @returns {Promise<Array>} Array of posts
   */
  async fetchTrending(params = {}) {
    const queryParams = new URLSearchParams({
      limit: params.limit || 100,
      offset: params.offset || 0,
      ...params
    });

    const data = await this.request(`/v1/trending?${queryParams}`);
    return data.posts || [];
  }

  /**
   * Fetch posts with pagination
   * @param {Object} params - Query parameters
   * @param {number} maxPosts - Maximum number of posts to fetch
   * @returns {Promise<Array>} Array of all posts
   */
  async fetchPaginated(params = {}, maxPosts = null) {
    const allPosts = [];
    let offset = 0;
    const limit = params.limit || 100;

    while (true) {
      const posts = await this.fetchTrending({ ...params, offset, limit });
      
      if (posts.length === 0) {
        break;
      }

      allPosts.push(...posts);
      this.logger.info({ fetched: allPosts.length, batch: posts.length }, 'Fetched posts batch');

      if (maxPosts && allPosts.length >= maxPosts) {
        return allPosts.slice(0, maxPosts);
      }

      if (posts.length < limit) {
        break;
      }

      offset += limit;
    }

    return allPosts;
  }

  /**
   * Fetch posts for multiple endpoints
   * @param {Array<string>} endpoints - Array of endpoint types
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Posts grouped by endpoint
   */
  async fetchMultipleEndpoints(endpoints, params = {}) {
    const results = {};

    for (const endpoint of endpoints) {
      this.logger.info({ endpoint }, 'Fetching from endpoint');
      results[endpoint] = await this.fetchPaginated({ ...params, endpoint });
    }

    return results;
  }
}
