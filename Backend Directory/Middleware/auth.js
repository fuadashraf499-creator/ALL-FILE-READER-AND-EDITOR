const jwt = require('jsonwebtoken');
const winston = require('winston');
const User = require('../models/User');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/auth-middleware.log' })
  ]
});

// Role hierarchy for permission checking
const ROLE_HIERARCHY = {
  'user': 0,
  'moderator': 1,
  'admin': 2
};

// Enhanced authentication middleware with database verification
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    logger.warn('Access denied: No token provided', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    return res.status(401).json({
      success: false,
      error: 'Access denied. No token provided.',
      code: 'NO_TOKEN'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user exists and is active
    const user = await User.findById(decoded.id).select('+loginAttempts +lockUntil');
    
    if (!user) {
      logger.warn('Token valid but user not found', {
        userId: decoded.id,
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({
        success: false,
        error: 'User not found.',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (!user.isActive) {
      logger.warn('Inactive user attempted access', {
        userId: user._id,
        username: user.username,
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated.',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }
    
    if (user.isLocked) {
      logger.warn('Locked user attempted access', {
        userId: user._id,
        username: user.username,
        lockUntil: user.lockUntil,
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({
        success: false,
        error: 'Account is temporarily locked due to failed login attempts.',
        code: 'ACCOUNT_LOCKED',
        lockUntil: user.lockUntil
      });
    }
    
    // Attach user object to request
    req.user = user;
    req.token = token;
    
    logger.info('User authenticated successfully', {
      userId: user._id,
      username: user.username,
      role: user.role,
      ip: req.ip,
      path: req.path
    });
    
    next();
  } catch (error) {
    logger.warn('Token verification failed', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    
    let errorCode = 'INVALID_TOKEN';
    let errorMessage = 'Invalid token.';
    
    if (error.name === 'TokenExpiredError') {
      errorCode = 'TOKEN_EXPIRED';
      errorMessage = 'Token has expired.';
    } else if (error.name === 'JsonWebTokenError') {
      errorCode = 'MALFORMED_TOKEN';
      errorMessage = 'Malformed token.';
    }
    
    return res.status(403).json({
      success: false,
      error: errorMessage,
      code: errorCode
    });
  }
};

// Role-based authorization middleware
const authorizeRole = (...roles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!roles.includes(req.user.role)) {
        logger.warn(`Unauthorized access attempt by user ${req.user.userId} with role ${req.user.role}`);
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      logger.error('Authorization middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Optional authentication middleware with database verification
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (user && user.isActive && !user.isLocked) {
      req.user = user;
      req.token = token;
      
      logger.info('Optional auth: User authenticated', {
        userId: user._id,
        username: user.username,
        role: user.role,
        ip: req.ip
      });
    } else {
      req.user = null;
    }
  } catch (error) {
    logger.info('Optional auth: Invalid token ignored', {
      error: error.message,
      ip: req.ip
    });
    req.user = null;
  }

  next();
};

// Role-based access control middleware
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
        code: 'AUTH_REQUIRED'
      });
    }
    
    const userRoleLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredRoleLevel = ROLE_HIERARCHY[requiredRole] || 0;
    
    if (userRoleLevel < requiredRoleLevel) {
      logger.warn('Insufficient permissions', {
        userId: req.user._id,
        userRole: req.user.role,
        requiredRole,
        ip: req.ip,
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions.',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: requiredRole,
        current: req.user.role
      });
    }
    
    next();
  };
};

// Permission-based access control middleware
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
        code: 'AUTH_REQUIRED'
      });
    }
    
    if (!req.user.hasPermission(permission)) {
      logger.warn('Permission denied', {
        userId: req.user._id,
        username: req.user.username,
        permission,
        userPermissions: req.user.permissions,
        ip: req.ip,
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        error: `Permission '${permission}' required.`,
        code: 'PERMISSION_DENIED',
        permission
      });
    }
    
    next();
  };
};

// Resource ownership middleware
const requireOwnership = (resourceModel, resourceIdParam = 'id') => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
        code: 'AUTH_REQUIRED'
      });
    }
    
    try {
      const resourceId = req.params[resourceIdParam];
      const resource = await resourceModel.findById(resourceId);
      
      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found.',
          code: 'RESOURCE_NOT_FOUND'
        });
      }
      
      // Admin can access any resource
      if (req.user.role === 'admin') {
        req.resource = resource;
        return next();
      }
      
      // Check ownership
      const isOwner = resource.owner ? 
        resource.owner.toString() === req.user._id.toString() :
        resource.uploadedBy ? 
          resource.uploadedBy.toString() === req.user._id.toString() :
          false;
      
      if (!isOwner) {
        logger.warn('Resource access denied - not owner', {
          userId: req.user._id,
          resourceId,
          resourceType: resourceModel.modelName,
          ip: req.ip,
          path: req.path
        });
        
        return res.status(403).json({
          success: false,
          error: 'Access denied. You do not own this resource.',
          code: 'NOT_OWNER'
        });
      }
      
      req.resource = resource;
      next();
    } catch (error) {
      logger.error('Ownership check error', {
        error: error.message,
        userId: req.user._id,
        ip: req.ip,
        path: req.path
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal server error.',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

// Email verification middleware
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required.',
      code: 'AUTH_REQUIRED'
    });
  }
  
  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      error: 'Email verification required.',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }
  
  next();
};

// Rate limiting by user
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();
  
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }
    
    const userId = req.user._id.toString();
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    if (userRequests.has(userId)) {
      const requests = userRequests.get(userId).filter(time => time > windowStart);
      userRequests.set(userId, requests);
    } else {
      userRequests.set(userId, []);
    }
    
    const requests = userRequests.get(userId);
    
    if (requests.length >= maxRequests) {
      logger.warn('User rate limit exceeded', {
        userId,
        requests: requests.length,
        maxRequests,
        ip: req.ip,
        path: req.path
      });
      
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    requests.push(now);
    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRole,
  optionalAuth,
  requireRole,
  requirePermission,
  requireOwnership,
  requireEmailVerification,
  userRateLimit
};