const Sentry = require('@sentry/node');
const winston = require('winston');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Performance monitoring class
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.startTimes = new Map();
    this.alerts = [];
    this.thresholds = {
      responseTime: 5000, // 5 seconds
      memoryUsage: 0.9, // 90% of available memory
      cpuUsage: 0.8, // 80% CPU usage
      diskUsage: 0.9, // 90% disk usage
      errorRate: 0.05 // 5% error rate
    };
  }

  // Start timing an operation
  startTimer(operationId) {
    this.startTimes.set(operationId, Date.now());
  }

  // End timing and record metric
  endTimer(operationId, metadata = {}) {
    const startTime = this.startTimes.get(operationId);
    if (!startTime) return null;

    const duration = Date.now() - startTime;
    this.startTimes.delete(operationId);

    const metric = {
      operationId,
      duration,
      timestamp: new Date(),
      metadata
    };

    // Store metric
    if (!this.metrics.has(operationId)) {
      this.metrics.set(operationId, []);
    }
    this.metrics.get(operationId).push(metric);

    // Check for performance issues
    if (duration > this.thresholds.responseTime) {
      this.createAlert('SLOW_RESPONSE', {
        operationId,
        duration,
        threshold: this.thresholds.responseTime,
        metadata
      });
    }

    return metric;
  }

  // Get system metrics
  getSystemMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = usedMem / totalMem;

    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    return {
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usage: memoryUsage
      },
      cpu: {
        count: cpus.length,
        loadAverage: loadAvg,
        usage: loadAvg[0] / cpus.length // Approximate CPU usage
      },
      uptime: os.uptime(),
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname()
    };
  }

  // Get disk usage
  async getDiskUsage() {
    try {
      const stats = await fs.promises.stat(process.cwd());
      // This is a simplified disk usage check
      // In production, you'd want to use a more comprehensive solution
      return {
        available: true,
        path: process.cwd(),
        stats
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  // Create performance alert
  createAlert(type, data) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity: this.getAlertSeverity(type, data),
      message: this.getAlertMessage(type, data),
      data,
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.push(alert);

    // Log alert
    logger.warn('Performance alert created', alert);

    // Send to Sentry if configured
    if (Sentry.getCurrentHub().getClient()) {
      Sentry.captureMessage(`Performance Alert: ${alert.message}`, 'warning');
    }

    return alert;
  }

  getAlertSeverity(type, data) {
    switch (type) {
      case 'SLOW_RESPONSE':
        return data.duration > this.thresholds.responseTime * 2 ? 'critical' : 'warning';
      case 'HIGH_MEMORY':
        return data.usage > 0.95 ? 'critical' : 'warning';
      case 'HIGH_CPU':
        return data.usage > 0.9 ? 'critical' : 'warning';
      case 'HIGH_ERROR_RATE':
        return data.rate > 0.1 ? 'critical' : 'warning';
      default:
        return 'info';
    }
  }

  getAlertMessage(type, data) {
    switch (type) {
      case 'SLOW_RESPONSE':
        return `Slow response detected: ${data.operationId} took ${data.duration}ms (threshold: ${data.threshold}ms)`;
      case 'HIGH_MEMORY':
        return `High memory usage: ${(data.usage * 100).toFixed(1)}% (threshold: ${(this.thresholds.memoryUsage * 100).toFixed(1)}%)`;
      case 'HIGH_CPU':
        return `High CPU usage: ${(data.usage * 100).toFixed(1)}% (threshold: ${(this.thresholds.cpuUsage * 100).toFixed(1)}%)`;
      case 'HIGH_ERROR_RATE':
        return `High error rate: ${(data.rate * 100).toFixed(1)}% (threshold: ${(this.thresholds.errorRate * 100).toFixed(1)}%)`;
      default:
        return `Alert: ${type}`;
    }
  }

  // Get performance statistics
  getStats(operationId = null) {
    if (operationId) {
      const metrics = this.metrics.get(operationId) || [];
      if (metrics.length === 0) return null;

      const durations = metrics.map(m => m.duration);
      return {
        operationId,
        count: metrics.length,
        average: durations.reduce((a, b) => a + b, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        recent: metrics.slice(-10) // Last 10 metrics
      };
    }

    // Return overall stats
    const allMetrics = [];
    for (const [opId, metrics] of this.metrics) {
      allMetrics.push(...metrics);
    }

    if (allMetrics.length === 0) return null;

    const durations = allMetrics.map(m => m.duration);
    return {
      totalOperations: allMetrics.length,
      averageResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      minResponseTime: Math.min(...durations),
      maxResponseTime: Math.max(...durations),
      operationTypes: this.metrics.size,
      alerts: this.alerts.length,
      unresolvedAlerts: this.alerts.filter(a => !a.resolved).length
    };
  }

  // Clear old metrics (keep last 1000 per operation)
  cleanup() {
    for (const [operationId, metrics] of this.metrics) {
      if (metrics.length > 1000) {
        this.metrics.set(operationId, metrics.slice(-1000));
      }
    }

    // Clear old alerts (keep last 100)
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }
}

// Error tracking class
class ErrorTracker {
  constructor() {
    this.errors = [];
    this.errorCounts = new Map();
    this.errorRates = new Map();
  }

  // Track an error
  trackError(error, context = {}) {
    const errorInfo = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: error.message,
      stack: error.stack,
      name: error.name,
      context,
      timestamp: new Date(),
      fingerprint: this.generateFingerprint(error)
    };

    this.errors.push(errorInfo);

    // Update error counts
    const count = this.errorCounts.get(errorInfo.fingerprint) || 0;
    this.errorCounts.set(errorInfo.fingerprint, count + 1);

    // Log error
    logger.error('Error tracked', errorInfo);

    // Send to Sentry if configured
    if (Sentry.getCurrentHub().getClient()) {
      Sentry.withScope(scope => {
        scope.setContext('error_context', context);
        scope.setFingerprint([errorInfo.fingerprint]);
        Sentry.captureException(error);
      });
    }

    return errorInfo;
  }

  // Generate error fingerprint for grouping
  generateFingerprint(error) {
    const key = `${error.name}:${error.message.substring(0, 100)}`;
    return Buffer.from(key).toString('base64').substring(0, 16);
  }

  // Get error statistics
  getErrorStats() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    const recentErrors = this.errors.filter(e => now - e.timestamp.getTime() < oneHour);
    const dailyErrors = this.errors.filter(e => now - e.timestamp.getTime() < oneDay);

    return {
      total: this.errors.length,
      lastHour: recentErrors.length,
      lastDay: dailyErrors.length,
      uniqueErrors: this.errorCounts.size,
      topErrors: this.getTopErrors(10),
      errorRate: this.calculateErrorRate()
    };
  }

  // Get top errors by frequency
  getTopErrors(limit = 10) {
    return Array.from(this.errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([fingerprint, count]) => {
        const error = this.errors.find(e => e.fingerprint === fingerprint);
        return {
          fingerprint,
          count,
          message: error?.message || 'Unknown',
          lastOccurrence: this.errors
            .filter(e => e.fingerprint === fingerprint)
            .sort((a, b) => b.timestamp - a.timestamp)[0]?.timestamp
        };
      });
  }

  // Calculate error rate
  calculateErrorRate() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const recentErrors = this.errors.filter(e => now - e.timestamp.getTime() < oneHour);
    
    // This is a simplified calculation
    // In production, you'd want to track total requests as well
    return {
      errorsPerHour: recentErrors.length,
      timestamp: new Date()
    };
  }

  // Cleanup old errors
  cleanup() {
    const maxErrors = 10000;
    if (this.errors.length > maxErrors) {
      this.errors = this.errors.slice(-maxErrors);
      
      // Rebuild error counts
      this.errorCounts.clear();
      this.errors.forEach(error => {
        const count = this.errorCounts.get(error.fingerprint) || 0;
        this.errorCounts.set(error.fingerprint, count + 1);
      });
    }
  }
}

// Health check system
class HealthChecker {
  constructor() {
    this.checks = new Map();
    this.results = new Map();
  }

  // Register a health check
  registerCheck(name, checkFunction, options = {}) {
    this.checks.set(name, {
      name,
      check: checkFunction,
      timeout: options.timeout || 5000,
      interval: options.interval || 30000,
      critical: options.critical || false,
      lastRun: null,
      lastResult: null
    });
  }

  // Run a specific health check
  async runCheck(name) {
    const check = this.checks.get(name);
    if (!check) {
      throw new Error(`Health check '${name}' not found`);
    }

    const startTime = Date.now();
    let result;

    try {
      // Run check with timeout
      const checkPromise = Promise.resolve(check.check());
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), check.timeout);
      });

      const checkResult = await Promise.race([checkPromise, timeoutPromise]);
      
      result = {
        name,
        status: 'healthy',
        message: checkResult?.message || 'OK',
        data: checkResult?.data || null,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
    } catch (error) {
      result = {
        name,
        status: 'unhealthy',
        message: error.message,
        error: error.stack,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };

      // Log unhealthy check
      logger.warn('Health check failed', result);

      // Send to Sentry if critical
      if (check.critical && Sentry.getCurrentHub().getClient()) {
        Sentry.captureException(error, {
          tags: {
            healthCheck: name,
            critical: true
          }
        });
      }
    }

    // Update check info
    check.lastRun = new Date();
    check.lastResult = result;
    this.results.set(name, result);

    return result;
  }

  // Run all health checks
  async runAllChecks() {
    const results = {};
    const promises = [];

    for (const [name] of this.checks) {
      promises.push(
        this.runCheck(name).then(result => {
          results[name] = result;
        }).catch(error => {
          results[name] = {
            name,
            status: 'error',
            message: error.message,
            timestamp: new Date()
          };
        })
      );
    }

    await Promise.all(promises);
    return results;
  }

  // Get overall health status
  getOverallHealth() {
    const results = Array.from(this.results.values());
    if (results.length === 0) {
      return {
        status: 'unknown',
        message: 'No health checks configured'
      };
    }

    const unhealthy = results.filter(r => r.status === 'unhealthy');
    const errors = results.filter(r => r.status === 'error');

    if (errors.length > 0) {
      return {
        status: 'error',
        message: `${errors.length} health check(s) failed with errors`,
        details: { errors: errors.length, unhealthy: unhealthy.length, total: results.length }
      };
    }

    if (unhealthy.length > 0) {
      return {
        status: 'unhealthy',
        message: `${unhealthy.length} health check(s) are unhealthy`,
        details: { unhealthy: unhealthy.length, total: results.length }
      };
    }

    return {
      status: 'healthy',
      message: 'All health checks are passing',
      details: { healthy: results.length, total: results.length }
    };
  }
}

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/monitoring.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  ]
});

// Initialize monitoring components
const performanceMonitor = new PerformanceMonitor();
const errorTracker = new ErrorTracker();
const healthChecker = new HealthChecker();

// Initialize Sentry if DSN is provided
function initializeSentry(dsn, options = {}) {
  if (!dsn) {
    logger.info('Sentry DSN not provided, error tracking will be local only');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: options.tracesSampleRate || 0.1,
      integrations: [
        Sentry.httpIntegration({ tracing: true }),
        ...(options.app ? [Sentry.expressIntegration({ app: options.app })] : [])
      ],
      beforeSend(event) {
        // Filter out sensitive data
        if (event.request) {
          delete event.request.headers?.authorization;
          delete event.request.headers?.cookie;
        }
        return event;
      }
    });

    logger.info('Sentry initialized successfully');
    } catch (error) {
      logger.warn('Failed to initialize Sentry:', error.message);
    }
  }

// Cleanup interval
setInterval(() => {
  performanceMonitor.cleanup();
  errorTracker.cleanup();
}, 5 * 60 * 1000); // Every 5 minutes

module.exports = {
  performanceMonitor,
  errorTracker,
  healthChecker,
  logger,
  initializeSentry,
  PerformanceMonitor,
  ErrorTracker,
  HealthChecker
};