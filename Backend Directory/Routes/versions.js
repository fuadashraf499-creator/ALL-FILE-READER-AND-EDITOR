const express = require('express');
const Joi = require('joi');
const winston = require('winston');
const { VersionControl } = require('../utils/versionControl');
const { authenticateToken, requirePermission, requireOwnership } = require('../middleware/auth');
const { rateLimits } = require('../middleware/security');
const router = express.Router();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/versions.log' })
  ]
});

// Initialize version control system
const versionControl = new VersionControl();

// Validation schemas
const initializeDocumentSchema = Joi.object({
  documentId: Joi.string().required(),
  content: Joi.string().default(''),
  metadata: Joi.object({
    author: Joi.string().optional(),
    message: Joi.string().optional(),
    type: Joi.string().optional()
  }).optional()
});

const createVersionSchema = Joi.object({
  documentId: Joi.string().required(),
  content: Joi.string().required(),
  metadata: Joi.object({
    author: Joi.string().optional(),
    message: Joi.string().optional(),
    branch: Joi.string().optional(),
    type: Joi.string().optional()
  }).optional()
});

const createBranchSchema = Joi.object({
  documentId: Joi.string().required(),
  branchName: Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).required(),
  fromVersionId: Joi.string().required(),
  metadata: Joi.object({
    description: Joi.string().optional(),
    protected: Joi.boolean().optional()
  }).optional()
});

const mergeBranchesSchema = Joi.object({
  documentId: Joi.string().required(),
  sourceBranch: Joi.string().required(),
  targetBranch: Joi.string().required(),
  metadata: Joi.object({
    message: Joi.string().optional(),
    strategy: Joi.string().valid('auto', 'manual').default('auto')
  }).optional()
});

const createTagSchema = Joi.object({
  documentId: Joi.string().required(),
  versionId: Joi.string().required(),
  tagName: Joi.string().pattern(/^[a-zA-Z0-9._-]+$/).required(),
  metadata: Joi.object({
    message: Joi.string().optional(),
    type: Joi.string().valid('release', 'milestone', 'backup', 'manual').default('manual')
  }).optional()
});

const historyQuerySchema = Joi.object({
  branch: Joi.string().optional(),
  author: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  includeContent: Joi.boolean().default(false),
  includeDiff: Joi.boolean().default(false),
  since: Joi.date().optional(),
  until: Joi.date().optional()
});

// Initialize document version control
router.post('/initialize', authenticateToken, requirePermission('upload'), async (req, res) => {
  try {
    const { error, value } = initializeDocumentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details[0].message,
        code: 'VALIDATION_ERROR'
      });
    }

    const { documentId, content, metadata = {} } = value;
    
    // Add user info to metadata
    const enrichedMetadata = {
      ...metadata,
      author: req.user.username,
      authorId: req.user._id.toString()
    };

    const initialVersion = versionControl.initializeDocument(
      documentId,
      content,
      enrichedMetadata
    );

    logger.info('Document version control initialized', {
      documentId,
      versionId: initialVersion.id,
      userId: req.user._id,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Document version control initialized',
      version: initialVersion
    });
  } catch (error) {
    logger.error('Version control initialization error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user._id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to initialize version control',
      code: 'INITIALIZATION_ERROR',
      details: error.message
    });
  }
});

// Create a new version
router.post('/create', authenticateToken, requirePermission('upload'), async (req, res) => {
  try {
    const { error, value } = createVersionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details[0].message,
        code: 'VALIDATION_ERROR'
      });
    }

    const { documentId, content, metadata = {} } = value;
    
    // Add user info to metadata
    const enrichedMetadata = {
      ...metadata,
      author: req.user.username,
      authorId: req.user._id.toString()
    };

    const newVersion = versionControl.createVersion(
      documentId,
      content,
      enrichedMetadata
    );

    logger.info('New version created', {
      documentId,
      versionId: newVersion.id,
      version: newVersion.version,
      userId: req.user._id,
      changes: newVersion.changes,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'New version created',
      version: newVersion
    });
  } catch (error) {
    logger.error('Version creation error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user._id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create version',
      code: 'VERSION_CREATION_ERROR',
      details: error.message
    });
  }
});

// Get version history
router.get('/history/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { error, value } = historyQuerySchema.validate(req.query);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details[0].message,
        code: 'VALIDATION_ERROR'
      });
    }

    const history = versionControl.getVersionHistory(documentId, value);
    const stats = versionControl.getDocumentStats(documentId);

    res.json({
      success: true,
      documentId,
      history,
      stats,
      pagination: {
        offset: value.offset,
        limit: value.limit,
        total: stats?.totalVersions || 0
      }
    });
  } catch (error) {
    logger.error('History fetch error:', {
      error: error.message,
      documentId: req.params.documentId,
      userId: req.user._id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch version history',
      code: 'HISTORY_FETCH_ERROR',
      details: error.message
    });
  }
});

// Get specific version
router.get('/version/:documentId/:versionId', authenticateToken, async (req, res) => {
  try {
    const { documentId, versionId } = req.params;
    const { includeContent = 'true', includeDiff = 'false' } = req.query;

    const version = versionControl.getVersion(documentId, versionId);
    
    if (!version) {
      return res.status(404).json({
        success: false,
        error: 'Version not found',
        code: 'VERSION_NOT_FOUND'
      });
    }

    // Remove content and diff based on query parameters
    const responseVersion = { ...version };
    
    if (includeContent !== 'true') {
      delete responseVersion.content;
    }
    
    if (includeDiff !== 'true') {
      delete responseVersion.diff;
    }

    res.json({
      success: true,
      version: responseVersion
    });
  } catch (error) {
    logger.error('Version fetch error:', {
      error: error.message,
      documentId: req.params.documentId,
      versionId: req.params.versionId,
      userId: req.user._id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch version',
      code: 'VERSION_FETCH_ERROR',
      details: error.message
    });
  }
});

// Compare versions
router.get('/compare/:documentId/:fromVersionId/:toVersionId', authenticateToken, async (req, res) => {
  try {
    const { documentId, fromVersionId, toVersionId } = req.params;

    const comparison = versionControl.compareVersions(
      documentId,
      fromVersionId,
      toVersionId
    );

    res.json({
      success: true,
      comparison
    });
  } catch (error) {
    logger.error('Version comparison error:', {
      error: error.message,
      documentId: req.params.documentId,
      fromVersionId: req.params.fromVersionId,
      toVersionId: req.params.toVersionId,
      userId: req.user._id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to compare versions',
      code: 'COMPARISON_ERROR',
      details: error.message
    });
  }
});

// Revert to version
router.post('/revert', authenticateToken, requirePermission('upload'), async (req, res) => {
  try {
    const { documentId, targetVersionId, message } = req.body;
    
    if (!documentId || !targetVersionId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID and target version ID are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    const metadata = {
      author: req.user.username,
      authorId: req.user._id.toString(),
      message: message || `Revert to previous version`
    };

    const revertVersion = versionControl.revertToVersion(
      documentId,
      targetVersionId,
      metadata
    );

    logger.info('Document reverted', {
      documentId,
      targetVersionId,
      newVersionId: revertVersion.id,
      userId: req.user._id,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Document reverted successfully',
      version: revertVersion
    });
  } catch (error) {
    logger.error('Revert error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user._id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to revert document',
      code: 'REVERT_ERROR',
      details: error.message
    });
  }
});

// Create branch
router.post('/branch/create', authenticateToken, requirePermission('upload'), async (req, res) => {
  try {
    const { error, value } = createBranchSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details[0].message,
        code: 'VALIDATION_ERROR'
      });
    }

    const { documentId, branchName, fromVersionId, metadata = {} } = value;
    
    const enrichedMetadata = {
      ...metadata,
      authorId: req.user._id.toString()
    };

    const branch = versionControl.createBranch(
      documentId,
      branchName,
      fromVersionId,
      enrichedMetadata
    );

    logger.info('Branch created', {
      documentId,
      branchName,
      fromVersionId,
      userId: req.user._id,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Branch created successfully',
      branch
    });
  } catch (error) {
    logger.error('Branch creation error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user._id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create branch',
      code: 'BRANCH_CREATION_ERROR',
      details: error.message
    });
  }
});

// Merge branches
router.post('/branch/merge', authenticateToken, requirePermission('upload'), async (req, res) => {
  try {
    const { error, value } = mergeBranchesSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details[0].message,
        code: 'VALIDATION_ERROR'
      });
    }

    const { documentId, sourceBranch, targetBranch, metadata = {} } = value;
    
    const enrichedMetadata = {
      ...metadata,
      author: req.user.username,
      authorId: req.user._id.toString()
    };

    const mergeResult = versionControl.mergeBranches(
      documentId,
      sourceBranch,
      targetBranch,
      enrichedMetadata
    );

    logger.info('Branches merged', {
      documentId,
      sourceBranch,
      targetBranch,
      mergeVersionId: mergeResult.mergeVersion.id,
      userId: req.user._id,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Branches merged successfully',
      result: mergeResult
    });
  } catch (error) {
    logger.error('Branch merge error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user._id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to merge branches',
      code: 'MERGE_ERROR',
      details: error.message
    });
  }
});

// Create tag
router.post('/tag/create', authenticateToken, requirePermission('upload'), async (req, res) => {
  try {
    const { error, value } = createTagSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details[0].message,
        code: 'VALIDATION_ERROR'
      });
    }

    const { documentId, versionId, tagName, metadata = {} } = value;
    
    const enrichedMetadata = {
      ...metadata,
      authorId: req.user._id.toString()
    };

    const tag = versionControl.createTag(
      documentId,
      versionId,
      tagName,
      enrichedMetadata
    );

    logger.info('Tag created', {
      documentId,
      versionId,
      tagName,
      userId: req.user._id,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Tag created successfully',
      tag
    });
  } catch (error) {
    logger.error('Tag creation error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user._id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create tag',
      code: 'TAG_CREATION_ERROR',
      details: error.message
    });
  }
});

// Get document statistics
router.get('/stats/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    const stats = versionControl.getDocumentStats(documentId);
    
    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'Document not found or not initialized for version control',
        code: 'DOCUMENT_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Stats fetch error:', {
      error: error.message,
      documentId: req.params.documentId,
      userId: req.user._id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch document statistics',
      code: 'STATS_FETCH_ERROR',
      details: error.message
    });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'version-control',
    status: 'operational',
    features: {
      versioning: true,
      branching: true,
      tagging: true,
      diffing: true,
      merging: true,
      reverting: true
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;