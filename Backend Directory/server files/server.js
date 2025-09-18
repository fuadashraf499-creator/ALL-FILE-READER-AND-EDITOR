const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { 
  rateLimits, 
  securityHeaders, 
  sanitizeInput, 
  securityMiddleware, 
  securityLogger 
} = require('./middleware/security');
require('dotenv').config();

// Initialize Express app
const app = express();
const server = http.createServer(app);


// MongoDB connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fileReaderDB';
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 3000,
      socketTimeoutMS: 3000,
    });
    
    logger.info('MongoDB connected successfully', {
      host: mongoose.connection.host,
      database: mongoose.connection.name
    });
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
    
  } catch (error) {
    logger.warn('MongoDB connection failed - continuing without database');
    // Don't log the full error stack to keep logs clean
  }
};

// Import monitoring utilities
const { initializeSentry } = require('./utils/monitoring');
const { 
  initializeRedis, 
  compressionMiddleware, 
  staticCacheHeaders, 
  responseCache 
} = require('./utils/performance');

// Connect to MongoDB (optional) - Disabled for testing
// connectDB().catch(() => {
//   logger.warn('MongoDB connection failed - continuing without database');
// });

// Initialize Sentry for error tracking
initializeSentry(process.env.SENTRY_DSN, { app });

// Initialize Redis for caching
initializeRedis(process.env.REDIS_URL);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'file-reader-backend' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Log that MongoDB is disabled for testing
logger.info('MongoDB connection disabled for testing - running in standalone mode');

// Enhanced Security Middleware
app.use(securityHeaders);
app.use(securityMiddleware);
app.use(securityLogger);
app.use(compression());
app.use(rateLimits.general);
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));
// Performance optimizations
app.use(compressionMiddleware);
app.use(staticCacheHeaders(86400)); // 24 hours cache for static files

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'fallback-session-secret',
  resave: false,
  saveUninitialized: false,
  // Using memory store for testing (MongoDB disabled)
  // store: MongoStore.create({
  //   mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/fileReaderDB',
  //   touchAfter: 24 * 3600, // lazy session update
  //   ttl: 14 * 24 * 60 * 60 // 14 days
  // }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  },
  name: 'fileReader.sid'
}));

logger.info('Using memory session store for testing (MongoDB disabled)');

app.use(sanitizeInput);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes
const uploadRoutes = require('./routes/upload');
const authRoutes = require('./routes/auth');
const convertRoutes = require('./routes/convert');
const ocrRoutes = require('./routes/ocr');
const sampleRoutes = require('./routes/sample');
const collaborationRoutes = require('./routes/collaboration');
const versionRoutes = require('./routes/versions');
const seoRoutes = require('./routes/seo');
const fileLoaderRoutes = require('./routes/file-loader');
const { router: monitoringRoutes, performanceMiddleware, errorTrackingMiddleware } = require('./routes/monitoring');

// Add performance monitoring to all routes
app.use(performanceMiddleware('api'));

app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/convert', convertRoutes);
app.use('/api/v1/ocr', ocrRoutes);
app.use('/api/v1/sample', responseCache({ ttl: 3600 }), sampleRoutes); // Cache sample files for 1 hour
app.use('/api/v1/collaboration', collaborationRoutes);
app.use('/api/v1/versions', versionRoutes);
app.use('/api/v1/file-loader', fileLoaderRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);
app.use('/', seoRoutes); // SEO routes at root level for sitemap.xml and robots.txt

// Initialize collaboration service
const { CollaborationService } = require('./utils/collaboration');
const collaborationService = new CollaborationService();
collaborationService.initialize(io);

// Store collaboration service in app for route access
app.set('collaborationService', collaborationService);

// Socket.io for real-time collaboration
io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.id}`);
  
  socket.on('join-document', (docId) => {
    socket.join(docId);
    logger.info(`User ${socket.id} joined document ${docId}`);
  });
  
  socket.on('document-edit', (data) => {
    socket.to(data.docId).emit('document-update', data);
  });
  
  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.id}`);
  });
});

// Error tracking middleware
app.use(errorTrackingMiddleware);

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 7834;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/v1/health`);
});

module.exports = { app, server, io };