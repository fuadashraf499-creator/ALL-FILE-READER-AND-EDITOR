const cluster = require('cluster');
const os = require('os');
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
const Redis = require('redis');
const Bull = require('bull');
const { S3Client } = require('@aws-sdk/client-s3');
const Sentry = require('@sentry/node');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Initialize Sentry for error tracking
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
  });
}

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'filereader-production' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Production clustering
if (process.env.CLUSTER_MODE === 'true' && cluster.isMaster) {
  const numWorkers = process.env.WORKER_PROCESSES || os.cpus().length;
  
  logger.info(`Master ${process.pid} is running`);
  logger.info(`Starting ${numWorkers} workers`);
  
  // Fork workers
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    logger.error(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
    logger.info('Starting a new worker');
    cluster.fork();
  });
  
  return;
}

// Worker process
logger.info(`Worker ${process.pid} started`);

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Redis client
let redisClient;
if (process.env.REDIS_URL) {
  redisClient = Redis.createClient({
    url: process.env.REDIS_URL,
    retry_strategy: (options) => {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        return new Error('The server refused the connection');
      }
      if (options.total_retry_time > 1000 * 60 * 60) {
        return new Error('Retry time exhausted');
      }
      if (options.attempt > 10) {
        return undefined;
      }
      return Math.min(options.attempt * 100, 3000);
    }
  });
  
  redisClient.on('error', (err) => {
    logger.error('Redis Client Error', err);
  });
  
  redisClient.on('connect', () => {
    logger.info('Redis connected successfully');
  });
} else {
  logger.warn('Redis URL not provided, using memory store');
}

// Initialize Bull queues for file processing
const fileProcessingQueue = new Bull('file processing', {
  redis: process.env.REDIS_URL ? { url: process.env.REDIS_URL } : undefined,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// MongoDB connection with production settings
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 50,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      bufferMaxEntries: 0,
    });
    
    logger.info('MongoDB connected successfully', {
      host: mongoose.connection.host,
      database: mongoose.connection.name
    });
    
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
      Sentry.captureException(err);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
    
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    Sentry.captureException(error);
    process.exit(1);
  }
};

// Initialize AWS S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Initialize email transporter
const emailTransporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT == 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Socket.IO with Redis adapter for clustering
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST']
  },
  adapter: redisClient ? require('socket.io-redis')(redisClient) : undefined,
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Compression
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
}));

// Rate limiting with Redis
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 300000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
  store: redisClient ? new (require('rate-limit-redis'))({
    client: redisClient,
    prefix: 'rl:',
  }) : undefined,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session management with MongoDB store
app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600,
    crypto: {
      secret: process.env.SESSION_SECRET || process.env.JWT_SECRET
    }
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 14 * 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  },
  name: 'filereader.sid'
}));

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    worker: process.pid
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
const { router: monitoringRoutes } = require('./routes/monitoring');

app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/convert', convertRoutes);
app.use('/api/v1/ocr', ocrRoutes);
app.use('/api/v1/sample', sampleRoutes);
app.use('/api/v1/collaboration', collaborationRoutes);
app.use('/api/v1/versions', versionRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);
app.use('/', seoRoutes);

// Collaboration service
const { CollaborationService } = require('./utils/collaboration');
const collaborationService = new CollaborationService();
collaborationService.initialize(io);
app.set('collaborationService', collaborationService);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use(Sentry.Handlers.errorHandler());

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  Sentry.captureException(err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    mongoose.connection.close();
    if (redisClient) redisClient.quit();
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 7834;

connectDB().then(() => {
  server.listen(PORT, () => {
    logger.info(`🚀 Production server running on port ${PORT}`);
    logger.info(`📊 Health check: http://localhost:${PORT}/api/v1/health`);
    logger.info(`👷 Worker PID: ${process.pid}`);
  });
}).catch(err => {
  logger.error('Failed to start server:', err);
  Sentry.captureException(err);
  process.exit(1);
});

module.exports = { app, server, io, fileProcessingQueue, s3Client, emailTransporter };