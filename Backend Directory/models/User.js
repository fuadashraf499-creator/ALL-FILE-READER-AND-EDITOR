const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// User schema definition
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [50, 'Username cannot exceed 50 characters'],
    match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens']
  },
  
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
  },
  
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in queries by default
  },
  
  firstName: {
    type: String,
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  
  lastName: {
    type: String,
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  
  avatar: {
    type: String,
    default: null
  },
  
  role: {
    type: String,
    enum: {
      values: ['user', 'admin', 'moderator'],
      message: 'Role must be either user, admin, or moderator'
    },
    default: 'user'
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  
  emailVerificationToken: {
    type: String,
    select: false
  },
  
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  
  passwordResetToken: {
    type: String,
    select: false
  },
  
  passwordResetExpires: {
    type: Date,
    select: false
  },
  
  lastLogin: {
    type: Date,
    default: null
  },
  
  loginAttempts: {
    type: Number,
    default: 0
  },
  
  lockUntil: {
    type: Date,
    select: false
  },
  
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    language: {
      type: String,
      default: 'en'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      collaboration: {
        type: Boolean,
        default: true
      }
    },
    privacy: {
      profileVisibility: {
        type: String,
        enum: ['public', 'private', 'friends'],
        default: 'public'
      },
      showEmail: {
        type: Boolean,
        default: false
      }
    }
  },
  
  permissions: {
    canUpload: {
      type: Boolean,
      default: true
    },
    canShare: {
      type: Boolean,
      default: true
    },
    canCollaborate: {
      type: Boolean,
      default: true
    },
    canComment: {
      type: Boolean,
      default: true
    },
    maxFileSize: {
      type: Number,
      default: 100 * 1024 * 1024 // 100MB in bytes
    },
    maxStorageSize: {
      type: Number,
      default: 5 * 1024 * 1024 * 1024 // 5GB in bytes
    }
  },
  
  stats: {
    filesUploaded: {
      type: Number,
      default: 0
    },
    storageUsed: {
      type: Number,
      default: 0
    },
    collaborationsJoined: {
      type: Number,
      default: 0
    },
    documentsCreated: {
      type: Number,
      default: 0
    }
  },
  
  twoFactorAuth: {
    enabled: {
      type: Boolean,
      default: false
    },
    secret: {
      type: String,
      select: false
    },
    backupCodes: {
      type: [String],
      select: false
    }
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.emailVerificationToken;
      delete ret.emailVerificationExpires;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      delete ret.lockUntil;
      delete ret.twoFactorAuth.secret;
      delete ret.twoFactorAuth.backupCodes;
      return ret;
    }
  }
});

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: 1 });
userSchema.index({ lastLogin: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.lastName || this.username;
});

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to update username case
userSchema.pre('save', function(next) {
  if (this.isModified('username')) {
    this.username = this.username.toLowerCase();
  }
  next();
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    throw new Error('Password not available for comparison');
  }
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to generate JWT token
userSchema.methods.generateAuthToken = function() {
  const payload = {
    id: this._id,
    username: this.username,
    email: this.email,
    role: this.role,
    permissions: this.permissions
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    issuer: 'file-reader-editor',
    audience: 'file-reader-users'
  });
};

// Instance method to generate refresh token
userSchema.methods.generateRefreshToken = function() {
  const payload = {
    id: this._id,
    type: 'refresh'
  };
  
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: '30d',
    issuer: 'file-reader-editor',
    audience: 'file-reader-users'
  });
};

// Instance method to handle failed login attempts
userSchema.methods.incLoginAttempts = async function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Instance method to reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Instance method to update last login
userSchema.methods.updateLastLogin = async function() {
  return this.updateOne({ lastLogin: new Date() });
};

// Instance method to check permissions
userSchema.methods.hasPermission = function(permission) {
  if (this.role === 'admin') return true;
  
  const permissionMap = {
    'upload': this.permissions.canUpload,
    'share': this.permissions.canShare,
    'collaborate': this.permissions.canCollaborate,
    'comment': this.permissions.canComment,
    'moderate': this.role === 'moderator' || this.role === 'admin',
    'admin': this.role === 'admin'
  };
  
  return permissionMap[permission] || false;
};

// Instance method to check if user can upload file
userSchema.methods.canUploadFile = function(fileSize) {
  if (!this.permissions.canUpload) return false;
  if (fileSize > this.permissions.maxFileSize) return false;
  if (this.stats.storageUsed + fileSize > this.permissions.maxStorageSize) return false;
  return true;
};

// Static method to find by email or username
userSchema.statics.findByEmailOrUsername = function(identifier) {
  return this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier.toLowerCase() }
    ]
  });
};

// Static method to find active users
userSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Static method to get user statistics
userSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: {
          $sum: {
            $cond: [{ $eq: ['$isActive', true] }, 1, 0]
          }
        },
        verifiedUsers: {
          $sum: {
            $cond: [{ $eq: ['$isEmailVerified', true] }, 1, 0]
          }
        },
        adminUsers: {
          $sum: {
            $cond: [{ $eq: ['$role', 'admin'] }, 1, 0]
          }
        },
        totalFilesUploaded: { $sum: '$stats.filesUploaded' },
        totalStorageUsed: { $sum: '$stats.storageUsed' }
      }
    }
  ]);
  
  return stats[0] || {
    totalUsers: 0,
    activeUsers: 0,
    verifiedUsers: 0,
    adminUsers: 0,
    totalFilesUploaded: 0,
    totalStorageUsed: 0
  };
};

// Export the model
module.exports = mongoose.model('User', userSchema);