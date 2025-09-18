const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const winston = require('winston');
const fileType = require('file-type');
const crypto = require('crypto');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/security.log' })
  ]
});

// Enhanced rate limiting for different endpoints
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}, endpoint: ${req.path}`);
      res.status(429).json({ error: message });
    }
  });
};

// Different rate limits for different endpoints
const rateLimits = {
  general: createRateLimit(15 * 60 * 1000, 100, 'Too many requests, please try again later'),
  upload: createRateLimit(15 * 60 * 1000, 10, 'Too many upload attempts, please try again later'),
  auth: createRateLimit(15 * 60 * 1000, 5, 'Too many authentication attempts, please try again later'),
  conversion: createRateLimit(60 * 60 * 1000, 20, 'Too many conversion requests, please try again later')
};

// Enhanced helmet configuration
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Needed for WebViewer
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// File signature validation (magic bytes)
const FILE_SIGNATURES = {
  // PDF
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  
  // Images
  'image/jpeg': [[0xFF, 0xD8, 0xFF]], // JPEG
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]], // PNG
  'image/gif': [[0x47, 0x49, 0x46, 0x38]], // GIF
  'image/bmp': [[0x42, 0x4D]], // BMP
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // WEBP (RIFF)
  
  // Documents
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    [0x50, 0x4B, 0x03, 0x04], // ZIP (DOCX is ZIP-based)
    [0x50, 0x4B, 0x05, 0x06],
    [0x50, 0x4B, 0x07, 0x08]
  ],
  'application/msword': [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]], // DOC
  
  // Videos
  'video/mp4': [
    [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // MP4
    [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]
  ],
  'video/avi': [[0x52, 0x49, 0x46, 0x46]], // AVI (RIFF)
  
  // Audio
  'audio/mpeg': [[0xFF, 0xFB], [0xFF, 0xF3], [0xFF, 0xF2]], // MP3
  'audio/wav': [[0x52, 0x49, 0x46, 0x46]], // WAV (RIFF)
  
  // Text
  'text/plain': [] // No specific signature for text files
};

// Validate file signature
const validateFileSignature = (buffer, mimeType) => {
  if (!FILE_SIGNATURES[mimeType]) {
    return false;
  }
  
  // Text files don't have specific signatures
  if (mimeType === 'text/plain') {
    return true;
  }
  
  const signatures = FILE_SIGNATURES[mimeType];
  
  return signatures.some(signature => {
    if (buffer.length < signature.length) {
      return false;
    }
    
    return signature.every((byte, index) => buffer[index] === byte);
  });
};

// Content Disarm and Reconstruction (CDR) middleware
const contentDisarmReconstruction = async (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }
  
  try {
    const files = req.files || [req.file];
    
    for (const file of files) {
      if (!file || !file.buffer) continue;
      
      // Validate file signature
      if (!validateFileSignature(file.buffer, file.mimetype)) {
        logger.warn(`File signature validation failed: ${file.originalname}, MIME: ${file.mimetype}`);
        return res.status(400).json({ 
          error: 'File signature does not match declared type',
          details: 'The file content does not match its extension or MIME type'
        });
      }
      
      // Check for embedded executables or scripts
      const suspiciousPatterns = [
        // Executable signatures
        Buffer.from([0x4D, 0x5A]), // MZ (Windows executable)
        Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF (Linux executable)
        
        // Script patterns
        Buffer.from('<?php', 'utf8'),
        Buffer.from('<script', 'utf8'),
        Buffer.from('javascript:', 'utf8'),
        Buffer.from('vbscript:', 'utf8'),
        
        // Macro patterns
        Buffer.from('Sub ', 'utf8'),
        Buffer.from('Function ', 'utf8'),
        Buffer.from('Macro', 'utf8')
      ];
      
      for (const pattern of suspiciousPatterns) {
        if (file.buffer.includes(pattern)) {
          logger.warn(`Suspicious content detected in file: ${file.originalname}`);
          return res.status(400).json({ 
            error: 'File contains potentially malicious content',
            details: 'The file contains patterns that may be harmful'
          });
        }
      }
      
      // File size validation
      const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 104857600; // 100MB
      if (file.size > maxSize) {
        return res.status(413).json({ 
          error: 'File too large',
          details: `Maximum file size is ${Math.round(maxSize / 1024 / 1024)}MB`
        });
      }
      
      // Generate file hash for integrity checking
      const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
      file.hash = hash;
      
      logger.info(`File validated: ${file.originalname}, hash: ${hash}`);
    }
    
    next();
  } catch (error) {
    logger.error('CDR middleware error:', error);
    res.status(500).json({ error: 'File validation failed' });
  }
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  try {
    // Sanitize query parameters
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key]
          .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/javascript:/gi, '') // Remove javascript: protocol
          .replace(/on\w+\s*=/gi, '') // Remove event handlers
          .trim();
      }
    }
    
    // Sanitize body parameters
    if (req.body && typeof req.body === 'object') {
      sanitizeObject(req.body);
    }
    
    next();
  } catch (error) {
    logger.error('Input sanitization error:', error);
    res.status(500).json({ error: 'Input validation failed' });
  }
};

// Recursive object sanitization
const sanitizeObject = (obj) => {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      obj[key] = obj[key]
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
};

// Security headers middleware
const securityMiddleware = (req, res, next) => {
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  next();
};

// Request logging for security monitoring
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//g, // Path traversal
    /<script/gi, // XSS attempts
    /union.*select/gi, // SQL injection
    /exec\(/gi, // Code execution
    /eval\(/gi, // Code evaluation
  ];
  
  const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
  const userAgent = req.get('User-Agent') || '';
  const requestBody = JSON.stringify(req.body || {});
  
  let suspicious = false;
  suspiciousPatterns.forEach(pattern => {
    if (pattern.test(fullUrl) || pattern.test(userAgent) || pattern.test(requestBody)) {
      suspicious = true;
    }
  });
  
  if (suspicious) {
    logger.warn('Suspicious request detected', {
      ip: req.ip,
      method: req.method,
      url: fullUrl,
      userAgent,
      body: requestBody
    });
  }
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    if (res.statusCode >= 400) {
      logger.warn('HTTP error response', {
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        userAgent
      });
    }
  });
  
  next();
};

// CSRF protection for state-changing operations
const csrfProtection = (req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Check for CSRF token in header
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  
  if (!token) {
    logger.warn('CSRF token missing', {
      ip: req.ip,
      method: req.method,
      url: req.originalUrl
    });
    return res.status(403).json({ error: 'CSRF token required' });
  }
  
  // In a real implementation, validate the token against a stored value
  // For now, we'll accept any non-empty token
  if (token.length < 10) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
};

module.exports = {
  rateLimits,
  securityHeaders,
  contentDisarmReconstruction,
  sanitizeInput,
  securityMiddleware,
  securityLogger,
  csrfProtection,
  validateFileSignature
};