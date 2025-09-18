const ShareDB = require('sharedb');
const WebSocket = require('ws');
const DiffMatchPatch = require('diff-match-patch');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/collaboration.log' })
  ]
});

// Initialize ShareDB backend
const backend = new ShareDB();

// In-memory database for development (use MongoDB in production)
const db = new ShareDB.MemoryDB();
backend.use('connect', (context, next) => {
  logger.info(`ShareDB connection: ${context.agent.clientId}`);
  next();
});

// Document types and operations
const documentTypes = {
  TEXT: 'text',
  JSON: 'json',
  RICH_TEXT: 'rich-text'
};

// Operational Transform for text documents
class TextOT {
  static apply(snapshot, op) {
    if (!snapshot) snapshot = '';
    
    let result = snapshot;
    let offset = 0;
    
    for (const component of op) {
      if (typeof component === 'string') {
        // Insert operation
        result = result.slice(0, offset) + component + result.slice(offset);
        offset += component.length;
      } else if (typeof component === 'number') {
        if (component > 0) {
          // Retain operation
          offset += component;
        } else {
          // Delete operation
          const deleteCount = -component;
          result = result.slice(0, offset) + result.slice(offset + deleteCount);
        }
      }
    }
    
    return result;
  }
  
  static transform(op1, op2, priority) {
    // Simplified transform - in production use a proper OT library
    return [op1, op2];
  }
  
  static compose(op1, op2) {
    // Compose two operations
    return [...op1, ...op2];
  }
}

// Register text type
ShareDB.types.register({
  name: 'text',
  uri: 'http://sharejs.org/types/textv1',
  create: () => '',
  apply: TextOT.apply,
  transform: TextOT.transform,
  compose: TextOT.compose
});

// Document management
class DocumentManager {
  constructor() {
    this.documents = new Map();
    this.userSessions = new Map();
    this.documentUsers = new Map();
  }
  
  // Create or get a document
  async getDocument(docId, type = 'text', initialContent = '') {
    try {
      const connection = backend.connect();
      const doc = connection.get('documents', docId);
      
      await new Promise((resolve, reject) => {
        doc.fetch((err) => {
          if (err) return reject(err);
          
          if (doc.type === null) {
            // Document doesn't exist, create it
            doc.create(initialContent, type, (err) => {
              if (err) return reject(err);
              resolve();
            });
          } else {
            resolve();
          }
        });
      });
      
      this.documents.set(docId, {
        doc,
        connection,
        type,
        createdAt: new Date(),
        lastModified: new Date()
      });
      
      logger.info(`Document ${docId} created/retrieved`);
      return doc;
    } catch (error) {
      logger.error(`Error getting document ${docId}:`, error);
      throw error;
    }
  }
  
  // Add user to document session
  addUserToDocument(docId, userId, userInfo) {
    if (!this.documentUsers.has(docId)) {
      this.documentUsers.set(docId, new Map());
    }
    
    const docUsers = this.documentUsers.get(docId);
    docUsers.set(userId, {
      ...userInfo,
      joinedAt: new Date(),
      lastActivity: new Date()
    });
    
    this.userSessions.set(userId, docId);
    
    logger.info(`User ${userId} joined document ${docId}`);
    return Array.from(docUsers.values());
  }
  
  // Remove user from document session
  removeUserFromDocument(docId, userId) {
    const docUsers = this.documentUsers.get(docId);
    if (docUsers) {
      docUsers.delete(userId);
      
      // Clean up empty document sessions
      if (docUsers.size === 0) {
        this.documentUsers.delete(docId);
        
        // Close document connection if no users
        const docInfo = this.documents.get(docId);
        if (docInfo) {
          docInfo.connection.close();
          this.documents.delete(docId);
        }
      }
    }
    
    this.userSessions.delete(userId);
    logger.info(`User ${userId} left document ${docId}`);
    
    return docUsers ? Array.from(docUsers.values()) : [];
  }
  
  // Get users in document
  getDocumentUsers(docId) {
    const docUsers = this.documentUsers.get(docId);
    return docUsers ? Array.from(docUsers.values()) : [];
  }
  
  // Update user activity
  updateUserActivity(userId) {
    const docId = this.userSessions.get(userId);
    if (docId) {
      const docUsers = this.documentUsers.get(docId);
      if (docUsers && docUsers.has(userId)) {
        const user = docUsers.get(userId);
        user.lastActivity = new Date();
      }
    }
  }
  
  // Get document statistics
  getDocumentStats(docId) {
    const docInfo = this.documents.get(docId);
    const users = this.getDocumentUsers(docId);
    
    return {
      exists: !!docInfo,
      type: docInfo?.type,
      createdAt: docInfo?.createdAt,
      lastModified: docInfo?.lastModified,
      activeUsers: users.length,
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        joinedAt: u.joinedAt,
        lastActivity: u.lastActivity
      }))
    };
  }
}

// Cursor and selection tracking
class CursorManager {
  constructor() {
    this.cursors = new Map(); // docId -> Map(userId -> cursor)
  }
  
  updateCursor(docId, userId, cursor) {
    if (!this.cursors.has(docId)) {
      this.cursors.set(docId, new Map());
    }
    
    const docCursors = this.cursors.get(docId);
    docCursors.set(userId, {
      ...cursor,
      timestamp: new Date()
    });
    
    return Array.from(docCursors.entries()).map(([id, cursor]) => ({
      userId: id,
      ...cursor
    }));
  }
  
  removeCursor(docId, userId) {
    const docCursors = this.cursors.get(docId);
    if (docCursors) {
      docCursors.delete(userId);
      
      if (docCursors.size === 0) {
        this.cursors.delete(docId);
      }
    }
  }
  
  getDocumentCursors(docId) {
    const docCursors = this.cursors.get(docId);
    if (!docCursors) return [];
    
    return Array.from(docCursors.entries()).map(([userId, cursor]) => ({
      userId,
      ...cursor
    }));
  }
}

// Comment and annotation system
class CommentManager {
  constructor() {
    this.comments = new Map(); // docId -> Map(commentId -> comment)
  }
  
  addComment(docId, comment) {
    if (!this.comments.has(docId)) {
      this.comments.set(docId, new Map());
    }
    
    const commentId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const docComments = this.comments.get(docId);
    
    const newComment = {
      id: commentId,
      ...comment,
      createdAt: new Date(),
      resolved: false
    };
    
    docComments.set(commentId, newComment);
    
    logger.info(`Comment added to document ${docId}: ${commentId}`);
    return newComment;
  }
  
  updateComment(docId, commentId, updates) {
    const docComments = this.comments.get(docId);
    if (docComments && docComments.has(commentId)) {
      const comment = docComments.get(commentId);
      Object.assign(comment, updates, { updatedAt: new Date() });
      return comment;
    }
    return null;
  }
  
  deleteComment(docId, commentId) {
    const docComments = this.comments.get(docId);
    if (docComments) {
      return docComments.delete(commentId);
    }
    return false;
  }
  
  getDocumentComments(docId) {
    const docComments = this.comments.get(docId);
    return docComments ? Array.from(docComments.values()) : [];
  }
}

// Main collaboration service
class CollaborationService {
  constructor() {
    this.documentManager = new DocumentManager();
    this.cursorManager = new CursorManager();
    this.commentManager = new CommentManager();
    this.dmp = new DiffMatchPatch();
  }
  
  // Initialize collaboration for a Socket.io instance
  initialize(io) {
    io.on('connection', (socket) => {
      logger.info(`User connected: ${socket.id}`);
      
      // Join document room
      socket.on('join-document', async (data) => {
        try {
          const { docId, user } = data;
          
          // Get or create document
          const doc = await this.documentManager.getDocument(docId);
          
          // Add user to document
          const users = this.documentManager.addUserToDocument(docId, socket.id, user);
          
          // Join socket room
          socket.join(docId);
          
          // Send initial document state
          socket.emit('document-state', {
            content: doc.data,
            version: doc.version,
            users,
            cursors: this.cursorManager.getDocumentCursors(docId),
            comments: this.commentManager.getDocumentComments(docId)
          });
          
          // Notify other users
          socket.to(docId).emit('user-joined', { user, users });
          
          logger.info(`User ${socket.id} joined document ${docId}`);
        } catch (error) {
          logger.error('Error joining document:', error);
          socket.emit('error', { message: 'Failed to join document' });
        }
      });
      
      // Handle document operations
      socket.on('operation', (data) => {
        try {
          const { docId, op } = data;
          const docInfo = this.documentManager.documents.get(docId);
          
          if (docInfo) {
            // Apply operation to ShareDB document
            docInfo.doc.submitOp(op, (err) => {
              if (err) {
                logger.error('Operation error:', err);
                socket.emit('operation-error', { error: err.message });
              } else {
                // Update last modified time
                docInfo.lastModified = new Date();
                
                // Update user activity
                this.documentManager.updateUserActivity(socket.id);
                
                // Broadcast operation to other users in the document
                socket.to(docId).emit('operation', {
                  op,
                  source: socket.id,
                  version: docInfo.doc.version
                });
              }
            });
          }
        } catch (error) {
          logger.error('Error handling operation:', error);
          socket.emit('operation-error', { error: error.message });
        }
      });
      
      // Handle cursor updates
      socket.on('cursor-update', (data) => {
        try {
          const { docId, cursor } = data;
          const cursors = this.cursorManager.updateCursor(docId, socket.id, cursor);
          
          // Broadcast cursor update to other users
          socket.to(docId).emit('cursor-update', {
            userId: socket.id,
            cursor,
            allCursors: cursors
          });
        } catch (error) {
          logger.error('Error updating cursor:', error);
        }
      });
      
      // Handle comments
      socket.on('add-comment', (data) => {
        try {
          const { docId, comment } = data;
          const newComment = this.commentManager.addComment(docId, comment);
          
          // Broadcast new comment to all users in document
          io.to(docId).emit('comment-added', newComment);
        } catch (error) {
          logger.error('Error adding comment:', error);
          socket.emit('error', { message: 'Failed to add comment' });
        }
      });
      
      // Handle comment updates
      socket.on('update-comment', (data) => {
        try {
          const { docId, commentId, updates } = data;
          const updatedComment = this.commentManager.updateComment(docId, commentId, updates);
          
          if (updatedComment) {
            io.to(docId).emit('comment-updated', updatedComment);
          }
        } catch (error) {
          logger.error('Error updating comment:', error);
        }
      });
      
      // Handle disconnection
      socket.on('disconnect', () => {
        try {
          const docId = this.documentManager.userSessions.get(socket.id);
          
          if (docId) {
            // Remove user from document
            const users = this.documentManager.removeUserFromDocument(docId, socket.id);
            
            // Remove cursor
            this.cursorManager.removeCursor(docId, socket.id);
            
            // Notify other users
            socket.to(docId).emit('user-left', {
              userId: socket.id,
              users
            });
          }
          
          logger.info(`User disconnected: ${socket.id}`);
        } catch (error) {
          logger.error('Error handling disconnect:', error);
        }
      });
    });
  }
  
  // Get document statistics
  getDocumentStats(docId) {
    return this.documentManager.getDocumentStats(docId);
  }
  
  // Export document content
  async exportDocument(docId) {
    const docInfo = this.documentManager.documents.get(docId);
    if (!docInfo) {
      throw new Error('Document not found');
    }
    
    return {
      content: docInfo.doc.data,
      version: docInfo.doc.version,
      type: docInfo.type,
      stats: this.getDocumentStats(docId)
    };
  }
}

// Export the collaboration service
module.exports = {
  CollaborationService,
  DocumentManager,
  CursorManager,
  CommentManager,
  backend,
  documentTypes
};