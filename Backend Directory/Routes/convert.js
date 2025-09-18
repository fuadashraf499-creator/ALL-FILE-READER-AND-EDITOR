const express = require('express');
const ConvertApi = require('convertapi');
const Joi = require('joi');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const winston = require('winston');
const { authenticateToken, optionalAuth, requirePermission } = require('../middleware/auth');
const { rateLimits } = require('../middleware/security');
const router = express.Router();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/convert.log' })
  ]
});

// Initialize ConvertAPI
let convertApiClient;
if (process.env.CONVERTAPI_SECRET && process.env.CONVERTAPI_SECRET !== 'demo-convert-api-secret') {
  convertApiClient = new ConvertApi(process.env.CONVERTAPI_SECRET);
  logger.info('ConvertAPI initialized with provided secret');
} else {
  logger.warn('ConvertAPI secret not configured - using demo mode');
  convertApiClient = null;
}

// Supported conversion formats
const SUPPORTED_CONVERSIONS = {
  // Document conversions
  'pdf': ['docx', 'doc', 'txt', 'html', 'jpg', 'png'],
  'docx': ['pdf', 'doc', 'txt', 'html', 'odt'],
  'doc': ['pdf', 'docx', 'txt', 'html', 'odt'],
  'xlsx': ['pdf', 'csv', 'html', 'ods'],
  'xls': ['pdf', 'xlsx', 'csv', 'html', 'ods'],
  'pptx': ['pdf', 'ppt', 'html', 'jpg', 'png'],
  'ppt': ['pdf', 'pptx', 'html', 'jpg', 'png'],
  'txt': ['pdf', 'docx', 'html'],
  'html': ['pdf', 'docx', 'txt'],
  'rtf': ['pdf', 'docx', 'txt', 'html'],
  
  // Image conversions
  'jpg': ['png', 'gif', 'bmp', 'tiff', 'webp', 'pdf'],
  'jpeg': ['png', 'gif', 'bmp', 'tiff', 'webp', 'pdf'],
  'png': ['jpg', 'gif', 'bmp', 'tiff', 'webp', 'pdf'],
  'gif': ['jpg', 'png', 'bmp', 'tiff', 'webp', 'pdf'],
  'bmp': ['jpg', 'png', 'gif', 'tiff', 'webp', 'pdf'],
  'tiff': ['jpg', 'png', 'gif', 'bmp', 'webp', 'pdf'],
  'webp': ['jpg', 'png', 'gif', 'bmp', 'tiff', 'pdf'],
  'svg': ['png', 'jpg', 'pdf'],
  
  // Video conversions
  'mp4': ['avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'],
  'avi': ['mp4', 'mov', 'wmv', 'flv', 'webm', 'mkv'],
  'mov': ['mp4', 'avi', 'wmv', 'flv', 'webm', 'mkv'],
  'wmv': ['mp4', 'avi', 'mov', 'flv', 'webm', 'mkv'],
  'flv': ['mp4', 'avi', 'mov', 'wmv', 'webm', 'mkv'],
  'webm': ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv'],
  'mkv': ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'],
  
  // Audio conversions
  'mp3': ['wav', 'flac', 'aac', 'ogg'],
  'wav': ['mp3', 'flac', 'aac', 'ogg'],
  'flac': ['mp3', 'wav', 'aac', 'ogg'],
  'aac': ['mp3', 'wav', 'flac', 'ogg'],
  'ogg': ['mp3', 'wav', 'flac', 'aac']
};

// Enhanced validation schemas
const convertSchema = Joi.object({
  sourceFormat: Joi.string().required(),
  targetFormat: Joi.string().required(),
  fileUrl: Joi.string().uri().optional(),
  fileData: Joi.string().base64().optional(),
  fileName: Joi.string().optional(),
  options: Joi.object({
    quality: Joi.number().min(1).max(100).optional(),
    pageRange: Joi.string().optional(),
    password: Joi.string().optional(),
    orientation: Joi.string().valid('portrait', 'landscape').optional(),
    paperSize: Joi.string().valid('A4', 'A3', 'A5', 'Letter', 'Legal').optional(),
    margin: Joi.object({
      top: Joi.number().optional(),
      bottom: Joi.number().optional(),
      left: Joi.number().optional(),
      right: Joi.number().optional()
    }).optional(),
    watermark: Joi.object({
      text: Joi.string().optional(),
      opacity: Joi.number().min(0).max(1).optional(),
      position: Joi.string().valid('center', 'top-left', 'top-right', 'bottom-left', 'bottom-right').optional()
    }).optional()
  }).optional()
}).xor('fileUrl', 'fileData');

const batchConvertSchema = Joi.object({
  conversions: Joi.array().items(convertSchema).min(1).max(10).required(),
  outputFormat: Joi.string().optional()
});

const conversionStatusSchema = Joi.object({
  jobId: Joi.string().required()
});

// Helper function will be defined later with CONVERTAPI_MAPPINGS

// Supported conversion formats and their mappings
const SUPPORTED_FORMATS = {
  // Document formats
  document: {
    input: ['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'html', 'epub', 'mobi'],
    output: ['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'html', 'epub']
  },
  // Spreadsheet formats
  spreadsheet: {
    input: ['xls', 'xlsx', 'ods', 'csv', 'tsv'],
    output: ['xls', 'xlsx', 'ods', 'csv', 'pdf']
  },
  // Presentation formats
  presentation: {
    input: ['ppt', 'pptx', 'odp'],
    output: ['ppt', 'pptx', 'odp', 'pdf', 'jpg', 'png']
  },
  // Image formats
  image: {
    input: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'svg', 'ico'],
    output: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'pdf']
  },
  // Audio formats
  audio: {
    input: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'],
    output: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a']
  },
  // Video formats
  video: {
    input: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'],
    output: ['mp4', 'avi', 'mov', 'wmv', 'webm', 'gif']
  },
  // Archive formats
  archive: {
    input: ['zip', 'rar', '7z', 'tar', 'gz'],
    output: ['zip', '7z', 'tar']
  }
};

// ConvertAPI format mappings
const CONVERTAPI_MAPPINGS = {
  // Document conversions
  'pdf-to-docx': { from: 'pdf', to: 'docx', service: 'pdf' },
  'docx-to-pdf': { from: 'docx', to: 'pdf', service: 'docx' },
  'doc-to-pdf': { from: 'doc', to: 'pdf', service: 'doc' },
  'html-to-pdf': { from: 'html', to: 'pdf', service: 'html' },
  'txt-to-pdf': { from: 'txt', to: 'pdf', service: 'txt' },
  
  // Image conversions
  'jpg-to-pdf': { from: 'jpg', to: 'pdf', service: 'jpg' },
  'png-to-pdf': { from: 'png', to: 'pdf', service: 'png' },
  'pdf-to-jpg': { from: 'pdf', to: 'jpg', service: 'pdf' },
  'pdf-to-png': { from: 'pdf', to: 'png', service: 'pdf' },
  
  // Spreadsheet conversions
  'xlsx-to-pdf': { from: 'xlsx', to: 'pdf', service: 'xlsx' },
  'xls-to-pdf': { from: 'xls', to: 'pdf', service: 'xls' },
  'csv-to-xlsx': { from: 'csv', to: 'xlsx', service: 'csv' },
  
  // Presentation conversions
  'pptx-to-pdf': { from: 'pptx', to: 'pdf', service: 'pptx' },
  'ppt-to-pdf': { from: 'ppt', to: 'pdf', service: 'ppt' }
};

// Helper function to check if conversion is supported
const isConversionSupported = (sourceFormat, targetFormat) => {
  const conversionKey = `${sourceFormat.toLowerCase()}-to-${targetFormat.toLowerCase()}`;
  return CONVERTAPI_MAPPINGS.hasOwnProperty(conversionKey);
};

// Helper function to get conversion mapping
const getConversionMapping = (sourceFormat, targetFormat) => {
  const conversionKey = `${sourceFormat.toLowerCase()}-to-${targetFormat.toLowerCase()}`;
  return CONVERTAPI_MAPPINGS[conversionKey];
};

// Helper function to generate unique job ID
const generateJobId = () => {
  return `conv_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
};

// In-memory job storage (use Redis in production)
const conversionJobs = new Map();

// Convert file endpoint
router.post('/convert', rateLimits.conversion, optionalAuth, requirePermission('upload'), async (req, res) => {
  try {
    // Validate input
    const { error, value } = convertSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details[0].message,
        code: 'VALIDATION_ERROR'
      });
    }

    const { sourceFormat, targetFormat, fileUrl, fileData, fileName, options = {} } = value;

    // Check if ConvertAPI is configured
    if (!process.env.CONVERTAPI_SECRET) {
      logger.warn('ConvertAPI secret not configured');
      return res.status(503).json({
        success: false,
        error: 'File conversion service is not available',
        code: 'SERVICE_UNAVAILABLE',
        message: 'ConvertAPI is not configured. Please contact administrator.'
      });
    }

    // Check if conversion is supported
    if (!isConversionSupported(sourceFormat, targetFormat)) {
      return res.status(400).json({
        success: false,
        error: 'Conversion not supported',
        code: 'UNSUPPORTED_CONVERSION',
        supportedFormats: SUPPORTED_FORMATS,
        requested: { from: sourceFormat, to: targetFormat }
      });
    }

    // Generate job ID for tracking
    const jobId = generateJobId();
    const userId = req.user?._id || 'anonymous';

    // Initialize job tracking
    conversionJobs.set(jobId, {
      id: jobId,
      userId,
      sourceFormat,
      targetFormat,
      fileName: fileName || 'unknown',
      status: 'processing',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      options
    });

    // Initialize ConvertAPI
    if (!convertApiClient) {
      throw new Error('ConvertAPI not configured - this is required for production');
    }
    
    const convertApi = convertApiClient;
    const mapping = getConversionMapping(sourceFormat, targetFormat);

    logger.info('Starting file conversion', {
      jobId,
      sourceFormat,
      targetFormat,
      fileName,
      hasFileUrl: !!fileUrl,
      hasFileData: !!fileData,
      userId,
      ip: req.ip
    });

    // Update job status
    const job = conversionJobs.get(jobId);
    job.status = 'converting';
    job.progress = 25;
    job.updatedAt = new Date();

    // Prepare conversion parameters
    const conversionParams = {
      ...options
    };

    // Add file source
    if (fileUrl) {
      conversionParams.File = fileUrl;
    } else if (fileData) {
      // Handle base64 data
      const buffer = Buffer.from(fileData, 'base64');
      const tempFileName = `temp_${jobId}.${sourceFormat}`;
      const tempFilePath = path.join(__dirname, '../temp', tempFileName);
      
      // Ensure temp directory exists
      await fs.mkdir(path.dirname(tempFilePath), { recursive: true });
      await fs.writeFile(tempFilePath, buffer);
      
      conversionParams.File = tempFilePath;
    }

    // Apply format-specific options
    if (targetFormat === 'pdf') {
      if (options.quality) conversionParams.ImageQuality = options.quality;
      if (options.orientation) conversionParams.Orientation = options.orientation;
      if (options.paperSize) conversionParams.PageSize = options.paperSize;
      if (options.margin) {
        conversionParams.MarginTop = options.margin.top || 10;
        conversionParams.MarginBottom = options.margin.bottom || 10;
        conversionParams.MarginLeft = options.margin.left || 10;
        conversionParams.MarginRight = options.margin.right || 10;
      }
      if (options.watermark?.text) {
        conversionParams.WatermarkText = options.watermark.text;
        conversionParams.WatermarkOpacity = options.watermark.opacity || 0.5;
        conversionParams.WatermarkPosition = options.watermark.position || 'center';
      }
    }

    if (options.pageRange && sourceFormat === 'pdf') {
      conversionParams.PageRange = options.pageRange;
    }

    if (options.password) {
      conversionParams.Password = options.password;
    }

    // Update progress
    job.progress = 50;
    job.updatedAt = new Date();

    // Perform conversion
    const result = await convertApi.convert(mapping.to, conversionParams, mapping.from);

    // Update progress
    job.progress = 75;
    job.updatedAt = new Date();

    // Get the converted file
    const convertedFile = result.file;
    const convertedFileUrl = convertedFile.url;
    const fileSize = convertedFile.size || 0;

    // Complete the job
    job.status = 'completed';
    job.progress = 100;
    job.result = {
      url: convertedFileUrl,
      size: fileSize,
      downloadUrl: convertedFileUrl,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
    job.completedAt = new Date();
    job.updatedAt = new Date();

    // Clean up temp file if created
    if (fileData) {
      try {
        const tempFileName = `temp_${jobId}.${sourceFormat}`;
        const tempFilePath = path.join(__dirname, '../temp', tempFileName);
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        logger.warn('Failed to clean up temp file:', cleanupError);
      }
    }

    logger.info('File conversion completed', {
      jobId,
      sourceFormat,
      targetFormat,
      originalSize: fileData ? Buffer.from(fileData, 'base64').length : 'unknown',
      convertedSize: fileSize,
      convertedUrl: convertedFileUrl,
      userId,
      duration: Date.now() - job.createdAt.getTime(),
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'File converted successfully',
      job: {
        id: jobId,
        status: job.status,
        progress: job.progress
      },
      conversion: {
        sourceFormat,
        targetFormat,
        fileName: job.fileName,
        result: job.result,
        options: job.options
      },
      download: {
        url: convertedFileUrl,
        expiresAt: job.result.expiresAt
      }
    });
  } catch (error) {
    const jobId = req.body.jobId || generateJobId();
    
    // Update job with error
    if (conversionJobs.has(jobId)) {
      const job = conversionJobs.get(jobId);
      job.status = 'failed';
      job.error = error.message;
      job.updatedAt = new Date();
    }

    logger.error('Conversion error:', {
      jobId,
      error: error.message,
      stack: error.stack,
      userId: req.user?._id,
      ip: req.ip
    });

    // Handle specific ConvertAPI errors
    let errorCode = 'CONVERSION_FAILED';
    let statusCode = 500;
    
    if (error.message.includes('Invalid file format')) {
      errorCode = 'INVALID_FORMAT';
      statusCode = 400;
    } else if (error.message.includes('File too large')) {
      errorCode = 'FILE_TOO_LARGE';
      statusCode = 413;
    } else if (error.message.includes('Insufficient credits')) {
      errorCode = 'INSUFFICIENT_CREDITS';
      statusCode = 402;
    }

    res.status(statusCode).json({
      success: false,
      error: 'Conversion failed',
      code: errorCode,
      details: error.message,
      jobId
    });
  }
});

// Get supported formats endpoint
router.get('/formats', (req, res) => {
  try {
    res.json({
      success: true,
      supportedConversions: SUPPORTED_CONVERSIONS,
      totalFormats: Object.keys(SUPPORTED_CONVERSIONS).length,
      categories: {
        documents: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'html', 'rtf'],
        images: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'svg'],
        videos: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'],
        audio: ['mp3', 'wav', 'flac', 'aac', 'ogg']
      }
    });
  } catch (error) {
    logger.error('Get formats error:', error);
    res.status(500).json({ error: 'Failed to get supported formats' });
  }
});

// Check conversion support endpoint
router.get('/check/:fromFormat/:toFormat', (req, res) => {
  try {
    const { fromFormat, toFormat } = req.params;
    const supported = isConversionSupported(fromFormat.toLowerCase(), toFormat.toLowerCase());
    
    res.json({
      success: true,
      fromFormat: fromFormat.toLowerCase(),
      toFormat: toFormat.toLowerCase(),
      supported,
      alternatives: supported ? [] : (SUPPORTED_CONVERSIONS[fromFormat.toLowerCase()] || [])
    });
  } catch (error) {
    logger.error('Check conversion error:', error);
    res.status(500).json({ error: 'Failed to check conversion support' });
  }
});

// Batch conversion endpoint
router.post('/batch', authenticateToken, async (req, res) => {
  try {
    const { conversions } = req.body;
    
    if (!Array.isArray(conversions) || conversions.length === 0) {
      return res.status(400).json({ error: 'Conversions array is required' });
    }
    
    if (conversions.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 conversions per batch' });
    }
    
    // Check if ConvertAPI is configured
    if (!process.env.CONVERTAPI_SECRET) {
      return res.status(503).json({ 
        error: 'Conversion service not configured'
      });
    }
    
    const results = [];
    
    for (const conversion of conversions) {
      try {
        const { error, value } = convertSchema.validate(conversion);
        if (error) {
          results.push({
            success: false,
            error: error.details[0].message,
            input: conversion
          });
          continue;
        }
        
        const { fileUrl, fromFormat, toFormat, options } = value;
        
        if (!isConversionSupported(fromFormat, toFormat)) {
          results.push({
            success: false,
            error: `Conversion from ${fromFormat} to ${toFormat} is not supported`,
            input: conversion
          });
          continue;
        }
        
        const convertParams = { File: fileUrl, ...options };
        if (!convertApiClient) {
        throw new Error('ConvertAPI not configured - this is required for production');
      }
      
      const result = await convertApiClient.convert(toFormat, convertParams, fromFormat);
        
        results.push({
          success: true,
          conversion: {
            fromFormat,
            toFormat,
            originalUrl: fileUrl,
            convertedUrl: result.file.url,
            fileName: result.file.fileName,
            fileSize: result.file.size,
            convertedAt: new Date().toISOString()
          }
        });
        
      } catch (conversionError) {
        logger.error('Batch conversion item error:', conversionError);
        results.push({
          success: false,
          error: 'Conversion failed',
          input: conversion
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    logger.info(`Batch conversion completed: ${successCount}/${conversions.length} successful`);
    
    res.json({
      success: true,
      results,
      summary: {
        total: conversions.length,
        successful: successCount,
        failed: conversions.length - successCount
      }
    });
    
  } catch (error) {
    logger.error('Batch conversion error:', error);
    res.status(500).json({ error: 'Batch conversion failed' });
  }
});

// Conversion status endpoint (for future async processing)
router.get('/status/:jobId', optionalAuth, (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Mock response - in real implementation, track conversion jobs
    res.json({
      success: true,
      jobId,
      status: 'completed',
      progress: 100,
      message: 'Conversions are currently processed synchronously',
      note: 'This endpoint is for future async conversion implementation'
    });
  } catch (error) {
    logger.error('Conversion status error:', error);
    res.status(500).json({ error: 'Failed to get conversion status' });
  }
});

// Get conversion job status
router.get('/status/:jobId', optionalAuth, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!conversionJobs.has(jobId)) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        code: 'JOB_NOT_FOUND'
      });
    }
    
    const job = conversionJobs.get(jobId);
    
    // Check if user has access to this job
    if (req.user && job.userId !== 'anonymous' && job.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }
    
    res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        sourceFormat: job.sourceFormat,
        targetFormat: job.targetFormat,
        fileName: job.fileName,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
        result: job.result,
        error: job.error
      }
    });
  } catch (error) {
    logger.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Batch conversion endpoint
router.post('/batch', rateLimits.conversion, authenticateToken, requirePermission('upload'), async (req, res) => {
  try {
    const { error, value } = batchConvertSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details[0].message,
        code: 'VALIDATION_ERROR'
      });
    }
    
    const { conversions, outputFormat } = value;
    const batchId = generateJobId();
    const userId = req.user._id;
    
    // Check ConvertAPI configuration
    if (!process.env.CONVERTAPI_SECRET) {
      return res.status(503).json({
        success: false,
        error: 'File conversion service is not available',
        code: 'SERVICE_UNAVAILABLE'
      });
    }
    
    // Validate all conversions
    for (const conversion of conversions) {
      if (!isConversionSupported(conversion.sourceFormat, conversion.targetFormat)) {
        return res.status(400).json({
          success: false,
          error: `Conversion from ${conversion.sourceFormat} to ${conversion.targetFormat} is not supported`,
          code: 'UNSUPPORTED_CONVERSION'
        });
      }
    }
    
    // Create batch job
    const batchJob = {
      id: batchId,
      userId,
      type: 'batch',
      status: 'processing',
      progress: 0,
      total: conversions.length,
      completed: 0,
      failed: 0,
      jobs: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    conversionJobs.set(batchId, batchJob);
    
    // Process conversions
    const results = [];
    
    for (let i = 0; i < conversions.length; i++) {
      const conversion = conversions[i];
      const jobId = generateJobId();
      
      try {
        // Create individual job
        const individualJob = {
          id: jobId,
          userId,
          batchId,
          sourceFormat: conversion.sourceFormat,
          targetFormat: conversion.targetFormat,
          fileName: conversion.fileName || `file_${i + 1}`,
          status: 'processing',
          progress: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          options: conversion.options || {}
        };
        
        conversionJobs.set(jobId, individualJob);
        batchJob.jobs.push(jobId);
        
        // Perform conversion (simplified for batch)
        if (!convertApiClient) {
          // Demo mode - simulate conversion
          individualJob.status = 'completed';
          individualJob.progress = 100;
          individualJob.result = {
            url: `/demo/converted-file-${i}-${Date.now()}.${conversion.targetFormat}`,
            size: 1024,
            downloadUrl: `/demo/converted-file-${i}-${Date.now()}.${conversion.targetFormat}`,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          };
          individualJob.completedAt = new Date();
          
          results.push({
            jobId,
            status: 'completed',
            result: individualJob.result,
            demo: true
          });
          
          batchJob.completed++;
          continue;
        }
        
        const convertApi = convertApiClient;
        const mapping = getConversionMapping(conversion.sourceFormat, conversion.targetFormat);
        
        const conversionParams = {
          File: conversion.fileUrl || conversion.fileData,
          ...conversion.options
        };
        
        const result = await convertApi.convert(mapping.to, conversionParams, mapping.from);
        
        // Update individual job
        individualJob.status = 'completed';
        individualJob.progress = 100;
        individualJob.result = {
          url: result.file.url,
          size: result.file.size,
          downloadUrl: result.file.url,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };
        individualJob.completedAt = new Date();
        
        results.push({
          jobId,
          status: 'completed',
          result: individualJob.result
        });
        
        batchJob.completed++;
      } catch (error) {
        logger.error(`Batch conversion error for job ${jobId}:`, error);
        
        const individualJob = conversionJobs.get(jobId);
        if (individualJob) {
          individualJob.status = 'failed';
          individualJob.error = error.message;
        }
        
        results.push({
          jobId,
          status: 'failed',
          error: error.message
        });
        
        batchJob.failed++;
      }
      
      // Update batch progress
      batchJob.progress = Math.round(((i + 1) / conversions.length) * 100);
      batchJob.updatedAt = new Date();
    }
    
    // Complete batch job
    batchJob.status = batchJob.failed === 0 ? 'completed' : 'partial';
    batchJob.completedAt = new Date();
    
    logger.info('Batch conversion completed', {
      batchId,
      total: batchJob.total,
      completed: batchJob.completed,
      failed: batchJob.failed,
      userId,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Batch conversion completed',
      batch: {
        id: batchId,
        status: batchJob.status,
        progress: batchJob.progress,
        total: batchJob.total,
        completed: batchJob.completed,
        failed: batchJob.failed
      },
      results
    });
  } catch (error) {
    logger.error('Batch conversion error:', error);
    res.status(500).json({
      success: false,
      error: 'Batch conversion failed',
      code: 'BATCH_CONVERSION_FAILED',
      details: error.message
    });
  }
});

// Get supported formats
router.get('/formats', (req, res) => {
  res.json({
    success: true,
    supportedFormats: SUPPORTED_FORMATS,
    availableConversions: Object.keys(CONVERTAPI_MAPPINGS),
    categories: Object.keys(SUPPORTED_FORMATS),
    totalFormats: Object.values(SUPPORTED_FORMATS).reduce((total, category) => {
      return total + category.input.length;
    }, 0)
  });
});

// Get conversion history (authenticated users only)
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, status, format } = req.query;
    
    // Filter jobs for current user
    const userJobs = Array.from(conversionJobs.values())
      .filter(job => job.userId.toString() === userId.toString())
      .filter(job => !status || job.status === status)
      .filter(job => !format || job.sourceFormat === format || job.targetFormat === format)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedJobs = userJobs.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      jobs: paginatedJobs.map(job => ({
        id: job.id,
        sourceFormat: job.sourceFormat,
        targetFormat: job.targetFormat,
        fileName: job.fileName,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        result: job.result,
        error: job.error
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: userJobs.length,
        pages: Math.ceil(userJobs.length / limit)
      }
    });
  } catch (error) {
    logger.error('History fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Health check for conversion service
router.get('/health', (req, res) => {
  const isConfigured = !!process.env.CONVERTAPI_SECRET;
  
  res.json({
    success: true,
    service: 'conversion',
    status: isConfigured ? 'available' : 'not_configured',
    configured: isConfigured,
    activeJobs: conversionJobs.size,
    supportedFormats: Object.keys(CONVERTAPI_MAPPINGS).length,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;