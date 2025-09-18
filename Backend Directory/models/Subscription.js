const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  plan: {
    type: String,
    enum: ['free', 'pro', 'enterprise', 'custom'],
    required: true,
    default: 'free',
    index: true
  },
  
  status: {
    type: String,
    enum: ['active', 'inactive', 'cancelled', 'suspended', 'past_due', 'trialing'],
    required: true,
    default: 'active',
    index: true
  },
  
  billing: {
    interval: {
      type: String,
      enum: ['monthly', 'yearly', 'lifetime'],
      default: 'monthly'
    },
    amount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'USD'
    },
    nextBillingDate: Date,
    lastBillingDate: Date,
    customerId: String, // Stripe customer ID
    subscriptionId: String, // Stripe subscription ID
    paymentMethodId: String,
    invoiceId: String
  },
  
  trial: {
    isTrialing: {
      type: Boolean,
      default: false
    },
    trialStart: Date,
    trialEnd: Date,
    trialDays: {
      type: Number,
      default: 14
    }
  },
  
  features: {
    maxFileSize: {
      type: Number,
      default: 104857600 // 100MB
    },
    maxStorageSize: {
      type: Number,
      default: 1073741824 // 1GB
    },
    maxMonthlyUploads: {
      type: Number,
      default: 100
    },
    maxCollaborators: {
      type: Number,
      default: 3
    },
    maxProjects: {
      type: Number,
      default: 5
    },
    apiCallsPerMonth: {
      type: Number,
      default: 1000
    },
    features: [{
      name: String,
      enabled: {
        type: Boolean,
        default: true
      },
      limit: Number
    }],
    advancedFeatures: {
      aiAnalysis: {
        type: Boolean,
        default: false
      },
      realTimeCollaboration: {
        type: Boolean,
        default: false
      },
      advancedOCR: {
        type: Boolean,
        default: false
      },
      customBranding: {
        type: Boolean,
        default: false
      },
      apiAccess: {
        type: Boolean,
        default: false
      },
      prioritySupport: {
        type: Boolean,
        default: false
      },
      ssoIntegration: {
        type: Boolean,
        default: false
      },
      auditLogs: {
        type: Boolean,
        default: false
      },
      dataRetention: {
        type: Number,
        default: 30 // days
      }
    }
  },
  
  usage: {
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    filesUploaded: {
      type: Number,
      default: 0
    },
    storageUsed: {
      type: Number,
      default: 0
    },
    apiCallsMade: {
      type: Number,
      default: 0
    },
    collaboratorsUsed: {
      type: Number,
      default: 0
    },
    projectsUsed: {
      type: Number,
      default: 0
    },
    bandwidthUsed: {
      type: Number,
      default: 0
    }
  },
  
  history: [{
    action: {
      type: String,
      enum: ['created', 'upgraded', 'downgraded', 'cancelled', 'renewed', 'suspended', 'reactivated'],
      required: true
    },
    fromPlan: String,
    toPlan: String,
    amount: Number,
    reason: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: mongoose.Schema.Types.Mixed
  }],
  
  discounts: [{
    code: String,
    type: {
      type: String,
      enum: ['percentage', 'fixed']
    },
    value: Number,
    appliedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: Date,
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  enterprise: {
    isEnterprise: {
      type: Boolean,
      default: false
    },
    contractStart: Date,
    contractEnd: Date,
    seats: {
      type: Number,
      default: 1
    },
    customDomain: String,
    dedicatedSupport: {
      type: Boolean,
      default: false
    },
    sla: {
      uptime: {
        type: Number,
        default: 99.9
      },
      responseTime: {
        type: Number,
        default: 24 // hours
      }
    },
    compliance: [{
      type: String,
      enum: ['SOC2', 'HIPAA', 'GDPR', 'ISO27001']
    }]
  },
  
  notifications: {
    billingReminders: {
      type: Boolean,
      default: true
    },
    usageAlerts: {
      type: Boolean,
      default: true
    },
    featureUpdates: {
      type: Boolean,
      default: true
    }
  },
  
  metadata: {
    source: String, // How they signed up
    referralCode: String,
    campaignId: String,
    salesRepId: String,
    notes: String
  }
}, {
  timestamps: true,
  collection: 'subscriptions'
});

// Indexes
subscriptionSchema.index({ userId: 1 }, { unique: true });
subscriptionSchema.index({ plan: 1, status: 1 });
subscriptionSchema.index({ 'billing.nextBillingDate': 1 });
subscriptionSchema.index({ 'trial.trialEnd': 1 });
subscriptionSchema.index({ 'enterprise.isEnterprise': 1 });

// Virtual for days until trial ends
subscriptionSchema.virtual('trialDaysRemaining').get(function() {
  if (!this.trial.isTrialing || !this.trial.trialEnd) return 0;
  const now = new Date();
  const trialEnd = new Date(this.trial.trialEnd);
  const diffTime = trialEnd - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// Virtual for usage percentage
subscriptionSchema.virtual('usagePercentage').get(function() {
  const storage = (this.usage.storageUsed / this.features.maxStorageSize) * 100;
  const uploads = (this.usage.filesUploaded / this.features.maxMonthlyUploads) * 100;
  const apiCalls = (this.usage.apiCallsMade / this.features.apiCallsPerMonth) * 100;
  
  return {
    storage: Math.min(100, storage),
    uploads: Math.min(100, uploads),
    apiCalls: Math.min(100, apiCalls)
  };
});

// Methods
subscriptionSchema.methods.canUploadFile = function(fileSize) {
  const withinSizeLimit = fileSize <= this.features.maxFileSize;
  const withinStorageLimit = (this.usage.storageUsed + fileSize) <= this.features.maxStorageSize;
  const withinUploadLimit = this.usage.filesUploaded < this.features.maxMonthlyUploads;
  
  return {
    allowed: withinSizeLimit && withinStorageLimit && withinUploadLimit,
    reasons: {
      fileSize: withinSizeLimit,
      storage: withinStorageLimit,
      uploads: withinUploadLimit
    }
  };
};

subscriptionSchema.methods.canMakeApiCall = function() {
  return this.usage.apiCallsMade < this.features.apiCallsPerMonth;
};

subscriptionSchema.methods.hasFeature = function(featureName) {
  return this.features.advancedFeatures[featureName] === true;
};

subscriptionSchema.methods.incrementUsage = async function(type, amount = 1) {
  if (this.usage[type] !== undefined) {
    this.usage[type] += amount;
    return this.save();
  }
  throw new Error(`Invalid usage type: ${type}`);
};

subscriptionSchema.methods.resetMonthlyUsage = async function() {
  this.usage.filesUploaded = 0;
  this.usage.apiCallsMade = 0;
  this.usage.bandwidthUsed = 0;
  this.usage.currentPeriodStart = new Date();
  
  // Set next period end based on billing interval
  const nextPeriodEnd = new Date();
  if (this.billing.interval === 'monthly') {
    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
  } else if (this.billing.interval === 'yearly') {
    nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
  }
  this.usage.currentPeriodEnd = nextPeriodEnd;
  
  return this.save();
};

subscriptionSchema.methods.addToHistory = async function(action, details = {}) {
  this.history.push({
    action,
    fromPlan: details.fromPlan || this.plan,
    toPlan: details.toPlan,
    amount: details.amount,
    reason: details.reason,
    metadata: details.metadata
  });
  
  return this.save();
};

subscriptionSchema.methods.applyDiscount = async function(discountCode, discountData) {
  this.discounts.push({
    code: discountCode,
    type: discountData.type,
    value: discountData.value,
    expiresAt: discountData.expiresAt
  });
  
  return this.save();
};

// Static methods
subscriptionSchema.statics.getPlanLimits = function(planName) {
  const plans = {
    free: {
      maxFileSize: 104857600, // 100MB
      maxStorageSize: 1073741824, // 1GB
      maxMonthlyUploads: 100,
      maxCollaborators: 3,
      maxProjects: 5,
      apiCallsPerMonth: 1000,
      advancedFeatures: {
        aiAnalysis: false,
        realTimeCollaboration: false,
        advancedOCR: false,
        customBranding: false,
        apiAccess: false,
        prioritySupport: false,
        ssoIntegration: false,
        auditLogs: false,
        dataRetention: 30
      }
    },
    pro: {
      maxFileSize: 1073741824, // 1GB
      maxStorageSize: 107374182400, // 100GB
      maxMonthlyUploads: 10000,
      maxCollaborators: 25,
      maxProjects: 100,
      apiCallsPerMonth: 50000,
      advancedFeatures: {
        aiAnalysis: true,
        realTimeCollaboration: true,
        advancedOCR: true,
        customBranding: false,
        apiAccess: true,
        prioritySupport: true,
        ssoIntegration: false,
        auditLogs: false,
        dataRetention: 90
      }
    },
    enterprise: {
      maxFileSize: 5368709120, // 5GB
      maxStorageSize: -1, // Unlimited
      maxMonthlyUploads: -1, // Unlimited
      maxCollaborators: -1, // Unlimited
      maxProjects: -1, // Unlimited
      apiCallsPerMonth: -1, // Unlimited
      advancedFeatures: {
        aiAnalysis: true,
        realTimeCollaboration: true,
        advancedOCR: true,
        customBranding: true,
        apiAccess: true,
        prioritySupport: true,
        ssoIntegration: true,
        auditLogs: true,
        dataRetention: 365
      }
    }
  };
  
  return plans[planName] || plans.free;
};

subscriptionSchema.statics.findExpiring = function(days = 7) {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + days);
  
  return this.find({
    status: 'active',
    'billing.nextBillingDate': { $lte: expirationDate }
  }).populate('userId', 'email firstName lastName');
};

subscriptionSchema.statics.findTrialsExpiring = function(days = 3) {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + days);
  
  return this.find({
    'trial.isTrialing': true,
    'trial.trialEnd': { $lte: expirationDate }
  }).populate('userId', 'email firstName lastName');
};

// Pre-save middleware
subscriptionSchema.pre('save', function(next) {
  // Set plan limits based on plan type
  if (this.isModified('plan')) {
    const limits = this.constructor.getPlanLimits(this.plan);
    Object.assign(this.features, limits);
  }
  
  // Set current period if not set
  if (!this.usage.currentPeriodStart) {
    this.usage.currentPeriodStart = new Date();
    const periodEnd = new Date();
    if (this.billing.interval === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else if (this.billing.interval === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }
    this.usage.currentPeriodEnd = periodEnd;
  }
  
  next();
});

module.exports = mongoose.model('Subscription', subscriptionSchema);