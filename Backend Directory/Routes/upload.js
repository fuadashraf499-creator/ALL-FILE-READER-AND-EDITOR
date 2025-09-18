const express = require('express');
const multer = require('multer');
const busboy = require('busboy');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const fileType = require('file-type');
const winston = require('winston');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { rateLimits, contentDisarmReconstruction } = require('../middleware/security');
// const ConvertApi = require('convertapi');
// const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
// const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
// const sharp = require('sharp');
// const Bull = require('bull');
const router = express.Router();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/upload.log' })
  ]
});

// Production features temporarily disabled for basic functionality
logger.info('Running in basic mode - production features will be enabled after dependency setup');

// Configure AWS S3 (legacy for compatibility)
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

// Allowed file types and their MIME types
const ALLOWED_FILE_TYPES = {
  // Documents
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.txt': ['text/plain'],
  '.rtf': ['application/rtf'],
  '.csv': ['text/csv'],
  
  // Images
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.bmp': ['image/bmp'],
  '.svg': ['image/svg+xml'],
  '.webp': ['image/webp'],
  '.tiff': ['image/tiff'],
  '.heic': ['image/heic'],
  
  // Videos
  '.mp4': ['video/mp4'],
  '.avi': ['video/x-msvideo'],
  '.mov': ['video/quicktime'],
  '.wmv': ['video/x-ms-wmv'],
  '.flv': ['video/x-flv'],
  '.webm': ['video/webm'],
  '.mkv': ['video/x-matroska'],
  
  // Audio
  '.mp3': ['audio/mpeg'],
  '.wav': ['audio/wav'],
  '.flac': ['audio/flac'],
  '.aac': ['audio/aac'],
  '.ogg': ['audio/ogg']
};

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 104857600; // 100MB default

// Validation schema
const uploadSchema = Joi.object({
  filename: Joi.string().required(),
  contentType: Joi.string().required(),
  fileSize: Joi.number().max(MAX_FILE_SIZE).required()
});

// Helper function to validate file type
const validateFileType = async (buffer, filename, mimeType) => {
  try {
    // Get file extension
    const ext = '.' + filename.split('.').pop().toLowerCase();
    
    // Check if extension is allowed
    if (!ALLOWED_FILE_TYPES[ext]) {
      return { valid: false, error: 'File type not allowed' };
    }
    
    // Check MIME type
    if (!ALLOWED_FILE_TYPES[ext].includes(mimeType)) {
      return { valid: false, error: 'MIME type mismatch' };
    }
    
    // Verify file signature (magic bytes)
    const detectedType = await fileType.fromBuffer(buffer.slice(0, 4100));
    if (detectedType && !ALLOWED_FILE_TYPES[ext].includes(detectedType.mime)) {
      return { valid: false, error: 'File signature mismatch' };
    }
    
    return { valid: true };
  } catch (error) {
    logger.error('File validation error:', error);
    return { valid: false, error: 'File validation failed' };
  }
};

// Helper function to upload to S3
const uploadToS3 = async (buffer, filename, contentType) => {
  try {
    const key = `uploads/${uuidv4()}-${filename}`;
    
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
      Metadata: {
        'original-filename': filename,
        'upload-timestamp': new Date().toISOString()
      }
    };
    
    const result = await s3.upload(params).promise();
    return {
      success: true,
      url: result.Location,
      key: result.Key,
      etag: result.ETag
    };
  } catch (error) {
    logger.error('S3 upload error:', error);
    return {
      success: false,
      error: 'Failed to upload file to storage'
    };
  }
};

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (ALLOWED_FILE_TYPES[ext] && ALLOWED_FILE_TYPES[ext].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// Simple file upload endpoint
router.post('/simple', rateLimits.upload, optionalAuth, upload.single('file'), contentDisarmReconstruction, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { originalname, buffer, mimetype, size } = req.file;
    const userId = req.user?.id;

    // Validate file type
    const validation = await validateFileType(buffer, originalname, mimetype);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    // Generate unique file ID
    const fileId = uuidv4();
    
    // Generate unique filename
     const timestamp = Date.now();
     const extension = path.extname(originalname);
     const filename = `${fileId}-${timestamp}${extension}`;

     // Upload to S3 (basic implementation)
     const uploadResult = await uploadToS3(buffer, filename, mimetype);

     // Log upload
     logger.info('File uploaded successfully', {
       fileId,
       originalname,
       size,
       mimetype,
       userId: userId || 'anonymous',
       s3Key: uploadResult.Key
     });

     res.json({
       success: true,
       fileId,
       filename: originalname,
       size,
       mimetype,
       uploadedAt: new Date().toISOString(),
       fileUrl: uploadResult.Location || `/api/v1/upload/file/${fileId}`,
       s3Key: uploadResult.Key
     });

  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Upload failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Chunked upload endpoint for large files
router.post('/chunk', rateLimits.upload, optionalAuth, (req, res) => {
  try {
    const bb = busboy({ 
      headers: req.headers,
      limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1
      }
    });
    
    let fileData = [];
    let filename = '';
    let contentType = '';
    
    bb.on('file', (name, file, info) => {
      filename = info.filename;
      contentType = info.mimeType;
      
      file.on('data', (data) => {
        fileData.push(data);
      });
      
      file.on('end', async () => {
        try {
          const buffer = Buffer.concat(fileData);
          
          // Validate input
          const { error } = uploadSchema.validate({
            filename,
            contentType,
            fileSize: buffer.length
          });
          
          if (error) {
            return res.status(400).json({ error: error.details[0].message });
          }
          
          // Validate file type
          const validation = await validateFileType(buffer, filename, contentType);
          if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
          }
          
          // Upload to S3
          const uploadResult = await uploadToS3(buffer, filename, contentType);
          if (!uploadResult.success) {
            return res.status(500).json({ error: uploadResult.error });
          }
          
          logger.info(`Chunked file uploaded: ${filename} by user ${req.user?.userId || 'anonymous'}`);
          
          res.json({
            success: true,
            file: {
              id: uploadResult.key,
              filename: filename,
              size: buffer.length,
              contentType: contentType,
              url: uploadResult.url,
              uploadedAt: new Date().toISOString()
            }
          });
        } catch (error) {
          logger.error('Chunked upload processing error:', error);
          res.status(500).json({ error: 'Upload processing failed' });
        }
      });
    });
    
    bb.on('error', (error) => {
      logger.error('Busboy error:', error);
      res.status(400).json({ error: 'Upload parsing failed' });
    });
    
    req.pipe(bb);
  } catch (error) {
    logger.error('Chunked upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get file info endpoint
router.get('/info/:fileId', optionalAuth, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileId
    };
    
    const headResult = await s3.headObject(params).promise();
    
    res.json({
      success: true,
      file: {
        id: fileId,
        filename: headResult.Metadata['original-filename'],
        size: headResult.ContentLength,
        contentType: headResult.ContentType,
        lastModified: headResult.LastModified,
        uploadedAt: headResult.Metadata['upload-timestamp']
      }
    });
  } catch (error) {
    if (error.code === 'NotFound') {
      return res.status(404).json({ error: 'File not found' });
    }
    logger.error('Get file info error:', error);
    res.status(500).json({ error: 'Failed to get file info' });
  }
});

// Generate signed URL for file access
router.get('/signed-url/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { action = 'getObject', expires = 3600 } = req.query;
    
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileId,
      Expires: parseInt(expires)
    };
    
    const signedUrl = s3.getSignedUrl(action, params);
    
    res.json({
      success: true,
      signedUrl,
      expiresIn: expires
    });
  } catch (error) {
    logger.error('Signed URL generation error:', error);
    res.status(500).json({ error: 'Failed to generate signed URL' });
  }
});

// Status and file access endpoints temporarily disabled
// Will be re-enabled with production queue system

// Basic file info endpoint
router.get('/info/:fileId', optionalAuth, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    res.json({
      success: true,
      fileId,
      message: 'File processing completed',
      status: 'available'
    });
    
  } catch (error) {
    logger.error('File info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get file info'
    });
  }
});

module.exports = router;