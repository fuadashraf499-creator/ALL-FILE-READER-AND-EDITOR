const express = require('express');
const Joi = require('joi');
const winston = require('winston');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { rateLimits } = require('../middleware/security');
const router = express.Router();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/collaboration.log' })
  ]
});

// Validation schemas
const createDocumentSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  type: Joi.string().valid('text', 'json', 'rich-text').default('text'),
  content: Joi.string().default(''),
  isPublic: Joi.boolean().default(false),
  allowedUsers: Joi.array().items(Joi.string()).default([])
});

const updateDocumentSchema = Joi.object({
  title: Joi.string().min(1).max(200),
  isPublic: Joi.boolean(),
  allowedUsers: Joi.array().items(Joi.string())
});

// In-memory document metadata storage (use database in production)
const documentMetadata = new Map();

// Helper function to generate document ID
const generateDocumentId = () => {
  return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Create a new collaborative document
router.post('/documents', rateLimits.general, optionalAuth, async (req, res) => {
  try {
    // Validate input
    const { error, value } = createDocumentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    const { title, type, content, isPublic, allowedUsers } = value;
    const docId = generateDocumentId();
    const userId = req.user?.id || 'anonymous';
    const username = req.user?.username || 'Anonymous User';

    // Store document metadata
    const metadata = {
      id: docId,
      title,
      type,
      isPublic,
      allowedUsers,
      owner: {
        id: userId,
        username
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAccessed: new Date()
    };

    documentMetadata.set(docId, metadata);

    logger.info(`Document created: ${docId} by ${username}`);

    res.json({
      success: true,
      document: {
        id: docId,
        title,
        type,
        isPublic,
        owner: metadata.owner,
        createdAt: metadata.createdAt,
        collaborationUrl: `/collaboration/${docId}`
      }
    });
  } catch (error) {
    logger.error('Error creating document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create document'
    });
  }
});

// Get document metadata
router.get('/documents/:docId', rateLimits.general, optionalAuth, async (req, res) => {
  try {
    const { docId } = req.params;
    const metadata = documentMetadata.get(docId);

    if (!metadata) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    const userId = req.user?.id || 'anonymous';

    // Check access permissions
    if (!metadata.isPublic && 
        metadata.owner.id !== userId && 
        !metadata.allowedUsers.includes(userId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Update last accessed time
    metadata.lastAccessed = new Date();

    // Get collaboration statistics
    const collaborationService = req.app.get('collaborationService');
    const stats = collaborationService ? collaborationService.getDocumentStats(docId) : null;

    res.json({
      success: true,
      document: {
        ...metadata,
        stats
      }
    });
  } catch (error) {
    logger.error('Error getting document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get document'
    });
  }
});

// Update document metadata
router.put('/documents/:docId', rateLimits.general, authenticateToken, async (req, res) => {
  try {
    const { docId } = req.params;
    const metadata = documentMetadata.get(docId);

    if (!metadata) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    const userId = req.user.id;

    // Check if user is owner
    if (metadata.owner.id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only document owner can update metadata'
      });
    }

    // Validate input
    const { error, value } = updateDocumentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details[0].message
      });
    }

    // Update metadata
    Object.assign(metadata, value, { updatedAt: new Date() });

    logger.info(`Document updated: ${docId} by ${req.user.username}`);

    res.json({
      success: true,
      document: metadata
    });
  } catch (error) {
    logger.error('Error updating document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update document'
    });
  }
});

// Delete document
router.delete('/documents/:docId', rateLimits.general, authenticateToken, async (req, res) => {
  try {
    const { docId } = req.params;
    const metadata = documentMetadata.get(docId);

    if (!metadata) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    const userId = req.user.id;

    // Check if user is owner
    if (metadata.owner.id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only document owner can delete document'
      });
    }

    // Remove metadata
    documentMetadata.delete(docId);

    logger.info(`Document deleted: ${docId} by ${req.user.username}`);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document'
    });
  }
});

// List user's documents
router.get('/documents', rateLimits.general, optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const { page = 1, limit = 20, type, search } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Filter documents
    let documents = Array.from(documentMetadata.values()).filter(doc => {
      // User's own documents or public documents or documents they have access to
      return doc.owner.id === userId || 
             doc.isPublic || 
             doc.allowedUsers.includes(userId);
    });

    // Apply filters
    if (type) {
      documents = documents.filter(doc => doc.type === type);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      documents = documents.filter(doc => 
        doc.title.toLowerCase().includes(searchLower)
      );
    }

    // Sort by last accessed (most recent first)
    documents.sort((a, b) => new Date(b.lastAccessed) - new Date(a.lastAccessed));

    // Paginate
    const total = documents.length;
    const paginatedDocs = documents.slice(offset, offset + limitNum);

    res.json({
      success: true,
      documents: paginatedDocs.map(doc => ({
        id: doc.id,
        title: doc.title,
        type: doc.type,
        isPublic: doc.isPublic,
        owner: doc.owner,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        lastAccessed: doc.lastAccessed,
        collaborationUrl: `/collaboration/${doc.id}`
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error('Error listing documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list documents'
    });
  }
});

// Get document collaboration statistics
router.get('/documents/:docId/stats', rateLimits.general, optionalAuth, async (req, res) => {
  try {
    const { docId } = req.params;
    const metadata = documentMetadata.get(docId);

    if (!metadata) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    const userId = req.user?.id || 'anonymous';

    // Check access permissions
    if (!metadata.isPublic && 
        metadata.owner.id !== userId && 
        !metadata.allowedUsers.includes(userId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get real-time collaboration statistics
    const collaborationService = req.app.get('collaborationService');
    const stats = collaborationService ? collaborationService.getDocumentStats(docId) : {
      exists: false,
      activeUsers: 0,
      users: []
    };

    res.json({
      success: true,
      stats: {
        ...stats,
        metadata: {
          title: metadata.title,
          type: metadata.type,
          owner: metadata.owner,
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt,
          lastAccessed: metadata.lastAccessed
        }
      }
    });
  } catch (error) {
    logger.error('Error getting document stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get document statistics'
    });
  }
});

// Export document content
router.get('/documents/:docId/export', rateLimits.general, optionalAuth, async (req, res) => {
  try {
    const { docId } = req.params;
    const metadata = documentMetadata.get(docId);

    if (!metadata) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    const userId = req.user?.id || 'anonymous';

    // Check access permissions
    if (!metadata.isPublic && 
        metadata.owner.id !== userId && 
        !metadata.allowedUsers.includes(userId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Export document
    const collaborationService = req.app.get('collaborationService');
    if (!collaborationService) {
      return res.status(503).json({
        success: false,
        error: 'Collaboration service not available'
      });
    }

    const exportData = await collaborationService.exportDocument(docId);

    res.json({
      success: true,
      export: {
        ...exportData,
        metadata
      }
    });
  } catch (error) {
    logger.error('Error exporting document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export document'
    });
  }
});

// Health check for collaboration service
router.get('/health', (req, res) => {
  const collaborationService = req.app.get('collaborationService');
  
  res.json({
    success: true,
    service: 'collaboration',
    status: collaborationService ? 'active' : 'inactive',
    timestamp: new Date().toISOString(),
    features: {
      realTimeEditing: true,
      operationalTransform: true,
      cursorTracking: true,
      comments: true,
      userPresence: true
    }
  });
});

module.exports = router;