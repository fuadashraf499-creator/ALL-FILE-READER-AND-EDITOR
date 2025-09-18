const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  fileId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  
  fileName: {
    type: String,
    required: true
  },
  
  mimeType: {
    type: String,
    required: true,
    index: true
  },
  
  size: {
    type: Number,
    required: true,
    index: true
  },
  
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  s3Key: {
    type: String,
    required: true
  },
  
  s3Bucket: {
    type: String,
    required: true
  },
  
  status: {
    type: String,
    enum: ['uploading', 'processing', 'completed', 'failed', 'deleted'],
    default: 'uploading',
    index: true
  },
  
  processingJobId: {
    type: String,
    index: true
  },
  
  metadata: {
    width: Number,
    height: Number,
    duration: Number,
    pages: Number,
    encoding: String,
    compression: String,
    colorSpace: String,
    hasTransparency: Boolean,
    isAnimated: Boolean
  },
  
  thumbnails: [{
    size: String, // 'small', 'medium', 'large'
    s3Key: String,
    width: Number,
    height: Number
  }],
  
  versions: [{
    versionId: String,
    s3Key: String,
    size: Number,
    createdAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changes: String
  }],
  
  permissions: {
    isPublic: {
      type: Boolean,
      default: false
    },
    allowDownload: {
      type: Boolean,
      default: true
    },
    allowEdit: {
      type: Boolean,
      default: true
    },
    allowShare: {
      type: Boolean,
      default: true
    },
    sharedWith: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      permission: {
        type: String,
        enum: ['view', 'edit', 'admin'],
        default: 'view'
      },
      sharedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    downloads: {
      type: Number,
      default: 0
    },
    edits: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    lastViewed: Date,
    lastDownloaded: Date,
    lastEdited: Date
  },
  
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  folder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null
  },
  
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  
  deletedAt: Date,
  
  expiresAt: Date,
  
  virus: {
    scanned: {
      type: Boolean,
      default: false
    },
    clean: {
      type: Boolean,
      default: true
    },
    scanDate: Date,
    threats: [String]
  }
}, {
  timestamps: true,
  collection: 'files'
});

// Indexes for performance
fileSchema.index({ uploadedBy: 1, createdAt: -1 });
fileSchema.index({ mimeType: 1, status: 1 });
fileSchema.index({ size: 1 });
fileSchema.index({ tags: 1 });
fileSchema.index({ 'permissions.isPublic': 1 });
fileSchema.index({ isDeleted: 1, expiresAt: 1 });
fileSchema.index({ 'virus.clean': 1, 'virus.scanned': 1 });

// Virtual for file URL
fileSchema.virtual('url').get(function() {
  if (this.status === 'completed' && !this.isDeleted) {
    return `${process.env.FRONTEND_URL}/api/v1/files/${this.fileId}`;
  }
  return null;
});

// Virtual for file extension
fileSchema.virtual('extension').get(function() {
  return this.originalName.split('.').pop()?.toLowerCase() || '';
});

// Virtual for human readable size
fileSchema.virtual('humanSize').get(function() {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (this.size === 0) return '0 Bytes';
  const i = Math.floor(Math.log(this.size) / Math.log(1024));
  return Math.round(this.size / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// Methods
fileSchema.methods.incrementView = async function() {
  this.analytics.views += 1;
  this.analytics.lastViewed = new Date();
  return this.save();
};

fileSchema.methods.incrementDownload = async function() {
  this.analytics.downloads += 1;
  this.analytics.lastDownloaded = new Date();
  return this.save();
};

fileSchema.methods.incrementEdit = async function() {
  this.analytics.edits += 1;
  this.analytics.lastEdited = new Date();
  return this.save();
};

fileSchema.methods.incrementShare = async function() {
  this.analytics.shares += 1;
  return this.save();
};

fileSchema.methods.addVersion = async function(versionData) {
  this.versions.push({
    versionId: require('uuid').v4(),
    ...versionData
  });
  return this.save();
};

fileSchema.methods.shareWith = async function(userId, permission = 'view') {
  const existingShare = this.permissions.sharedWith.find(
    share => share.userId.toString() === userId.toString()
  );
  
  if (existingShare) {
    existingShare.permission = permission;
  } else {
    this.permissions.sharedWith.push({
      userId,
      permission,
      sharedAt: new Date()
    });
  }
  
  return this.save();
};

fileSchema.methods.canAccess = function(userId, requiredPermission = 'view') {
  // Owner can always access
  if (this.uploadedBy.toString() === userId.toString()) {
    return true;
  }
  
  // Check if file is public and only view permission is required
  if (this.permissions.isPublic && requiredPermission === 'view') {
    return true;
  }
  
  // Check shared permissions
  const share = this.permissions.sharedWith.find(
    share => share.userId.toString() === userId.toString()
  );
  
  if (!share) return false;
  
  const permissionLevels = { view: 1, edit: 2, admin: 3 };
  const userLevel = permissionLevels[share.permission] || 0;
  const requiredLevel = permissionLevels[requiredPermission] || 0;
  
  return userLevel >= requiredLevel;
};

// Static methods
fileSchema.statics.findByUser = function(userId, options = {}) {
  const query = { uploadedBy: userId, isDeleted: false };
  
  if (options.mimeType) {
    query.mimeType = new RegExp(options.mimeType, 'i');
  }
  
  if (options.folder) {
    query.folder = options.folder;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0);
};

fileSchema.statics.getStorageUsed = async function(userId) {
  const result = await this.aggregate([
    { $match: { uploadedBy: mongoose.Types.ObjectId(userId), isDeleted: false } },
    { $group: { _id: null, totalSize: { $sum: '$size' } } }
  ]);
  
  return result[0]?.totalSize || 0;
};

fileSchema.statics.getAnalytics = async function(userId, dateRange = {}) {
  const match = { uploadedBy: mongoose.Types.ObjectId(userId), isDeleted: false };
  
  if (dateRange.start || dateRange.end) {
    match.createdAt = {};
    if (dateRange.start) match.createdAt.$gte = new Date(dateRange.start);
    if (dateRange.end) match.createdAt.$lte = new Date(dateRange.end);
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalFiles: { $sum: 1 },
        totalSize: { $sum: '$size' },
        totalViews: { $sum: '$analytics.views' },
        totalDownloads: { $sum: '$analytics.downloads' },
        totalEdits: { $sum: '$analytics.edits' },
        totalShares: { $sum: '$analytics.shares' },
        avgFileSize: { $avg: '$size' }
      }
    }
  ]);
};

// Pre-save middleware
fileSchema.pre('save', function(next) {
  if (this.isDeleted && !this.deletedAt) {
    this.deletedAt = new Date();
  }
  next();
});

// TTL index for expired files
fileSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('File', fileSchema);