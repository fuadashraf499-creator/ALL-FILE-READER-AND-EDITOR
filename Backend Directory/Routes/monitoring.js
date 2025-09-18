const express = require('express');
const mongoose = require('mongoose');
const { 
  performanceMonitor, 
  errorTracker, 
  healthChecker, 
  logger 
} = require('../utils/monitoring');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Register health checks
healthChecker.registerCheck('database', async () => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is not ready');
  }
  
  // Test database query
  await mongoose.connection.db.admin().ping();
  
  return {
    message: 'Database is healthy',
    data: {
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    }
  };
}, { critical: true, timeout: 5000 });

healthChecker.registerCheck('memory', async () => {
  const systemMetrics = performanceMonitor.getSystemMetrics();
  const memoryUsage = systemMetrics.memory.usage;
  
  if (memoryUsage > 0.9) {
    throw new Error(`High memory usage: ${(memoryUsage * 100).toFixed(1)}%`);
  }
  
  return {
    message: 'Memory usage is normal',
    data: {
      usage: memoryUsage,
      used: systemMetrics.memory.used,
      total: systemMetrics.memory.total
    }
  };
}, { critical: false, timeout: 1000 });

healthChecker.registerCheck('disk', async () => {
  const diskInfo = await performanceMonitor.getDiskUsage();
  
  if (!diskInfo.available) {
    throw new Error(`Disk check failed: ${diskInfo.error}`);
  }
  
  return {
    message: 'Disk is accessible',
    data: diskInfo
  };
}, { critical: false, timeout: 2000 });

healthChecker.registerCheck('api', async () => {
  // Simple API health check
  const stats = performanceMonitor.getStats();
  
  if (stats && stats.averageResponseTime > 10000) {
    throw new Error(`High average response time: ${stats.averageResponseTime}ms`);
  }
  
  return {
    message: 'API is responding normally',
    data: stats
  };
}, { critical: true, timeout: 3000 });

// Public health check endpoint
router.get('/health', async (req, res) => {
  try {
    const overallHealth = healthChecker.getOverallHealth();
    const systemMetrics = performanceMonitor.getSystemMetrics();
    
    const response = {
      status: overallHealth.status,
      message: overallHealth.message,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      system: {
        memory: {
          usage: systemMetrics.memory.usage,
          used: systemMetrics.memory.used,
          total: systemMetrics.memory.total
        },
        cpu: {
          usage: systemMetrics.cpu.usage,
          loadAverage: systemMetrics.cpu.loadAverage[0]
        }
      }
    };
    
    // Set appropriate status code
    const statusCode = overallHealth.status === 'healthy' ? 200 : 
                      overallHealth.status === 'unhealthy' ? 503 : 500;
    
    res.status(statusCode).json(response);
  } catch (error) {
    logger.error('Health check endpoint error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Detailed health check endpoint (admin only)
router.get('/health/detailed', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const healthResults = await healthChecker.runAllChecks();
    const overallHealth = healthChecker.getOverallHealth();
    const systemMetrics = performanceMonitor.getSystemMetrics();
    const performanceStats = performanceMonitor.getStats();
    const errorStats = errorTracker.getErrorStats();
    
    res.json({
      overall: overallHealth,
      checks: healthResults,
      system: systemMetrics,
      performance: performanceStats,
      errors: errorStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Detailed health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get detailed health information',
      details: error.message
    });
  }
});

// Metrics endpoint (admin only)
router.get('/metrics', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { operation, format = 'json' } = req.query;
    
    let metrics;
    if (operation) {
      metrics = performanceMonitor.getStats(operation);
      if (!metrics) {
        return res.status(404).json({
          success: false,
          error: `No metrics found for operation: ${operation}`
        });
      }
    } else {
      metrics = {
        performance: performanceMonitor.getStats(),
        system: performanceMonitor.getSystemMetrics(),
        errors: errorTracker.getErrorStats(),
        alerts: performanceMonitor.alerts.filter(a => !a.resolved)
      };
    }
    
    if (format === 'prometheus') {
      // Convert to Prometheus format
      const prometheusMetrics = convertToPrometheus(metrics);
      res.set('Content-Type', 'text/plain');
      res.send(prometheusMetrics);
    } else {
      res.json({
        success: true,
        metrics,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Metrics endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics',
      details: error.message
    });
  }
});

// Alerts endpoint (admin only)
router.get('/alerts', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { resolved = 'false', severity, limit = 50 } = req.query;
    
    let alerts = performanceMonitor.alerts;
    
    // Filter by resolved status
    if (resolved === 'false') {
      alerts = alerts.filter(a => !a.resolved);
    } else if (resolved === 'true') {
      alerts = alerts.filter(a => a.resolved);
    }
    
    // Filter by severity
    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }
    
    // Sort by timestamp (newest first) and limit
    alerts = alerts
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit));
    
    res.json({
      success: true,
      alerts,
      total: alerts.length,
      filters: { resolved, severity, limit }
    });
  } catch (error) {
    logger.error('Alerts endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get alerts',
      details: error.message
    });
  }
});

// Resolve alert endpoint (admin only)
router.patch('/alerts/:alertId/resolve', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { alertId } = req.params;
    const { resolvedBy, notes } = req.body;
    
    const alert = performanceMonitor.alerts.find(a => a.id === alertId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
    
    if (alert.resolved) {
      return res.status(400).json({
        success: false,
        error: 'Alert is already resolved'
      });
    }
    
    // Resolve alert
    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy || req.user.username;
    alert.resolvedNotes = notes;
    
    logger.info('Alert resolved', {
      alertId,
      resolvedBy: alert.resolvedBy,
      notes
    });
    
    res.json({
      success: true,
      message: 'Alert resolved successfully',
      alert
    });
  } catch (error) {
    logger.error('Alert resolution error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert',
      details: error.message
    });
  }
});

// Error tracking endpoint (admin only)
router.get('/errors', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { limit = 50, fingerprint } = req.query;
    
    let errors = errorTracker.errors;
    
    // Filter by fingerprint if provided
    if (fingerprint) {
      errors = errors.filter(e => e.fingerprint === fingerprint);
    }
    
    // Sort by timestamp (newest first) and limit
    errors = errors
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit));
    
    const stats = errorTracker.getErrorStats();
    
    res.json({
      success: true,
      errors,
      stats,
      total: errors.length,
      filters: { limit, fingerprint }
    });
  } catch (error) {
    logger.error('Error tracking endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get error information',
      details: error.message
    });
  }
});

// System information endpoint (admin only)
router.get('/system', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const systemMetrics = performanceMonitor.getSystemMetrics();
    const diskUsage = await performanceMonitor.getDiskUsage();
    
    const systemInfo = {
      ...systemMetrics,
      disk: diskUsage,
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        version: process.version,
        versions: process.versions,
        memoryUsage: process.memoryUsage(),
        env: process.env.NODE_ENV
      },
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      system: systemInfo
    });
  } catch (error) {
    logger.error('System info endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system information',
      details: error.message
    });
  }
});

// Convert metrics to Prometheus format
function convertToPrometheus(metrics) {
  let output = '';
  
  if (metrics.performance) {
    const perf = metrics.performance;
    output += `# HELP app_response_time_avg Average response time in milliseconds\n`;
    output += `# TYPE app_response_time_avg gauge\n`;
    output += `app_response_time_avg ${perf.averageResponseTime || 0}\n\n`;
    
    output += `# HELP app_total_operations Total number of operations\n`;
    output += `# TYPE app_total_operations counter\n`;
    output += `app_total_operations ${perf.totalOperations || 0}\n\n`;
  }
  
  if (metrics.system) {
    const sys = metrics.system;
    output += `# HELP system_memory_usage Memory usage ratio\n`;
    output += `# TYPE system_memory_usage gauge\n`;
    output += `system_memory_usage ${sys.memory.usage}\n\n`;
    
    output += `# HELP system_cpu_usage CPU usage ratio\n`;
    output += `# TYPE system_cpu_usage gauge\n`;
    output += `system_cpu_usage ${sys.cpu.usage}\n\n`;
  }
  
  if (metrics.errors) {
    const err = metrics.errors;
    output += `# HELP app_errors_total Total number of errors\n`;
    output += `# TYPE app_errors_total counter\n`;
    output += `app_errors_total ${err.total || 0}\n\n`;
    
    output += `# HELP app_errors_last_hour Errors in the last hour\n`;
    output += `# TYPE app_errors_last_hour gauge\n`;
    output += `app_errors_last_hour ${err.lastHour || 0}\n\n`;
  }
  
  return output;
}

// Performance monitoring middleware
const performanceMiddleware = (operationName) => {
  return (req, res, next) => {
    const operationId = `${operationName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Start timing
    performanceMonitor.startTimer(operationId);
    
    // Store operation info in request
    req.monitoringInfo = {
      operationId,
      operationName,
      startTime: Date.now()
    };
    
    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function(...args) {
      // End timing
      performanceMonitor.endTimer(operationId, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      
      // Call original end
      originalEnd.apply(this, args);
    };
    
    next();
  };
};

// Error tracking middleware
const errorTrackingMiddleware = (err, req, res, next) => {
  // Track the error
  errorTracker.trackError(err, {
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    headers: req.headers,
    user: req.user ? {
      id: req.user._id,
      username: req.user.username
    } : null,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  next(err);
};

module.exports = {
  router,
  performanceMiddleware,
  errorTrackingMiddleware
};