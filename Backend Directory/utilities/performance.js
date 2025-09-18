const compression = require('compression');
const NodeCache = require('node-cache');
const redis = require('redis');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/performance.log' })
  ]
});

// In-memory cache for quick access
const memoryCache = new NodeCache({
  stdTTL: 600, // 10 minutes default TTL
  checkperiod: 120, // Check for expired keys every 2 minutes
  useClones: false // Better performance, but be careful with object mutations
});

// Redis client for distributed caching
let redisClient = null;
let redisConnected = false;

// Initialize Redis connection
async function initializeRedis(redisUrl) {
  if (!redisUrl) {
    logger.info('Redis URL not provided, using in-memory cache only');
    return;
  }

  try {
    redisClient = redis.createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 attempts');
            return new Error('Redis reconnection failed');
          }
          return Math.min(retries * 50, 1000);
        }
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error:', err);
      redisConnected = false;
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
      redisConnected = true;
    });

    redisClient.on('disconnect', () => {
      logger.warn('Redis disconnected');
      redisConnected = false;
    });

    await redisClient.connect();
    logger.info('Redis client initialized');
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    redisClient = null;
  }
}

// Cache management class
class CacheManager {
  constructor() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  // Get value from cache (tries Redis first, then memory cache)
  async get(key) {
    try {
      // Try Redis first if available
      if (redisConnected && redisClient) {
        try {
          const value = await redisClient.get(key);
          if (value !== null) {
            this.stats.hits++;
            return JSON.parse(value);
          }
        } catch (redisError) {
          logger.warn('Redis get error, falling back to memory cache:', redisError);
        }
      }

      // Fall back to memory cache
      const value = memoryCache.get(key);
      if (value !== undefined) {
        this.stats.hits++;
        return value;
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache get error:', error);
      return null;
    }
  }

  // Set value in cache
  async set(key, value, ttl = 600) {
    try {
      // Set in memory cache
      memoryCache.set(key, value, ttl);

      // Set in Redis if available
      if (redisConnected && redisClient) {
        try {
          await redisClient.setEx(key, ttl, JSON.stringify(value));
        } catch (redisError) {
          logger.warn('Redis set error:', redisError);
        }
      }

      this.stats.sets++;
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache set error:', error);
      return false;
    }
  }

  // Delete from cache
  async delete(key) {
    try {
      // Delete from memory cache
      memoryCache.del(key);

      // Delete from Redis if available
      if (redisConnected && redisClient) {
        try {
          await redisClient.del(key);
        } catch (redisError) {
          logger.warn('Redis delete error:', redisError);
        }
      }

      this.stats.deletes++;
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  // Clear all cache
  async clear() {
    try {
      // Clear memory cache
      memoryCache.flushAll();

      // Clear Redis if available
      if (redisConnected && redisClient) {
        try {
          await redisClient.flushAll();
        } catch (redisError) {
          logger.warn('Redis clear error:', redisError);
        }
      }

      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache clear error:', error);
      return false;
    }
  }

  // Get cache statistics
  getStats() {
    const memoryStats = memoryCache.getStats();
    return {
      ...this.stats,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      memory: {
        keys: memoryStats.keys,
        hits: memoryStats.hits,
        misses: memoryStats.misses,
        ksize: memoryStats.ksize,
        vsize: memoryStats.vsize
      },
      redis: {
        connected: redisConnected,
        client: !!redisClient
      }
    };
  }

  // Generate cache key
  generateKey(prefix, ...parts) {
    return `${prefix}:${parts.join(':')}`;
  }
}

// Create cache manager instance
const cacheManager = new CacheManager();

// Response caching middleware
const responseCache = (options = {}) => {
  const {
    ttl = 300, // 5 minutes default
    keyGenerator = (req) => `response:${req.method}:${req.originalUrl}`,
    condition = () => true,
    skipSuccessfulRequests = false,
    skipFailedRequests = true
  } = options;

  return async (req, res, next) => {
    // Skip if condition not met
    if (!condition(req)) {
      return next();
    }

    // Skip for non-GET requests by default
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = keyGenerator(req);

    try {
      // Try to get cached response
      const cachedResponse = await cacheManager.get(cacheKey);
      if (cachedResponse) {
        res.set(cachedResponse.headers);
        res.set('X-Cache', 'HIT');
        return res.status(cachedResponse.statusCode).send(cachedResponse.body);
      }

      // Cache miss - intercept response
      const originalSend = res.send;
      const originalJson = res.json;
      const originalStatus = res.status;
      let statusCode = 200;

      // Override status method
      res.status = function(code) {
        statusCode = code;
        return originalStatus.call(this, code);
      };

      // Override send method
      res.send = function(body) {
        // Cache successful responses
        if (!skipSuccessfulRequests && statusCode >= 200 && statusCode < 300) {
          const responseData = {
            statusCode,
            headers: res.getHeaders(),
            body
          };
          cacheManager.set(cacheKey, responseData, ttl).catch(err => {
            logger.warn('Failed to cache response:', err);
          });
        }

        res.set('X-Cache', 'MISS');
        return originalSend.call(this, body);
      };

      // Override json method
      res.json = function(obj) {
        // Cache successful responses
        if (!skipSuccessfulRequests && statusCode >= 200 && statusCode < 300) {
          const responseData = {
            statusCode,
            headers: res.getHeaders(),
            body: obj
          };
          cacheManager.set(cacheKey, responseData, ttl).catch(err => {
            logger.warn('Failed to cache response:', err);
          });
        }

        res.set('X-Cache', 'MISS');
        return originalJson.call(this, obj);
      };

      next();
    } catch (error) {
      logger.error('Response cache middleware error:', error);
      next();
    }
  };
};

// Compression middleware with custom configuration
const compressionMiddleware = compression({
  level: 6, // Compression level (1-9)
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Use compression filter
    return compression.filter(req, res);
  }
});

// Static file caching headers
const staticCacheHeaders = (maxAge = 86400) => {
  return (req, res, next) => {
    // Set cache headers for static files
    if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      res.set({
        'Cache-Control': `public, max-age=${maxAge}`,
        'Expires': new Date(Date.now() + maxAge * 1000).toUTCString(),
        'ETag': `"${Date.now()}"`
      });
    }
    next();
  };
};

// Database query caching
const queryCache = {
  // Cache database query results
  async cacheQuery(queryKey, queryFunction, ttl = 300) {
    try {
      // Try to get cached result
      const cached = await cacheManager.get(queryKey);
      if (cached) {
        return cached;
      }

      // Execute query
      const result = await queryFunction();
      
      // Cache the result
      await cacheManager.set(queryKey, result, ttl);
      
      return result;
    } catch (error) {
      logger.error('Query cache error:', error);
      // Fall back to executing query without caching
      return await queryFunction();
    }
  },

  // Invalidate cache for specific patterns
  async invalidatePattern(pattern) {
    try {
      // This is a simplified implementation
      // In production, you'd want to use Redis SCAN with pattern matching
      const keys = memoryCache.keys();
      const matchingKeys = keys.filter(key => key.includes(pattern));
      
      for (const key of matchingKeys) {
        await cacheManager.delete(key);
      }
      
      logger.info(`Invalidated ${matchingKeys.length} cache keys matching pattern: ${pattern}`);
    } catch (error) {
      logger.error('Cache invalidation error:', error);
    }
  }
};

// Performance monitoring for database queries
const monitorQuery = (queryName) => {
  return async (queryFunction) => {
    const startTime = Date.now();
    try {
      const result = await queryFunction();
      const duration = Date.now() - startTime;
      
      logger.info('Database query completed', {
        queryName,
        duration,
        success: true
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Database query failed', {
        queryName,
        duration,
        error: error.message,
        success: false
      });
      
      throw error;
    }
  };
};

// CDN URL helper
const cdnHelper = {
  // Generate CDN URL for static assets
  getCDNUrl(assetPath, cdnDomain = process.env.CDN_DOMAIN) {
    if (!cdnDomain) {
      return assetPath;
    }
    
    // Remove leading slash if present
    const cleanPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
    
    return `https://${cdnDomain}/${cleanPath}`;
  },

  // Generate optimized image URL
  getOptimizedImageUrl(imagePath, options = {}) {
    const {
      width,
      height,
      quality = 80,
      format = 'webp',
      cdnDomain = process.env.CDN_DOMAIN
    } = options;

    if (!cdnDomain) {
      return imagePath;
    }

    const params = new URLSearchParams();
    if (width) params.append('w', width.toString());
    if (height) params.append('h', height.toString());
    if (quality) params.append('q', quality.toString());
    if (format) params.append('f', format);

    const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
    const queryString = params.toString();
    
    return `https://${cdnDomain}/${cleanPath}${queryString ? `?${queryString}` : ''}`;
  }
};

// Performance optimization utilities
const performanceUtils = {
  // Debounce function calls
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Throttle function calls
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  // Batch operations
  createBatcher(batchSize = 100, flushInterval = 1000) {
    let batch = [];
    let timer = null;

    const flush = async (processor) => {
      if (batch.length === 0) return;
      
      const currentBatch = batch.splice(0);
      try {
        await processor(currentBatch);
      } catch (error) {
        logger.error('Batch processing error:', error);
      }
    };

    return {
      add(item, processor) {
        batch.push(item);
        
        // Flush if batch is full
        if (batch.length >= batchSize) {
          flush(processor);
        }
        
        // Set timer for automatic flush
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => flush(processor), flushInterval);
      },
      
      flush: (processor) => flush(processor)
    };
  }
};

// Cleanup function
const cleanup = async () => {
  try {
    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
    memoryCache.close();
    logger.info('Performance utilities cleaned up');
  } catch (error) {
    logger.error('Cleanup error:', error);
  }
};

// Handle process termination
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

module.exports = {
  initializeRedis,
  cacheManager,
  responseCache,
  compressionMiddleware,
  staticCacheHeaders,
  queryCache,
  monitorQuery,
  cdnHelper,
  performanceUtils,
  cleanup
};