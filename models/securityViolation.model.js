const mongoose = require('mongoose');

const securityViolationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  testAttemptId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'TestAttempt', 
    required: true 
  },
  practiceTestId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'PracticeTest', 
    required: true 
  },
  violationType: { 
    type: String, 
    enum: ['tab_switch', 'window_switch', 'copy_paste', 'right_click', 'developer_tools'], 
    required: true 
  },
  violationCount: { 
    type: Number, 
    default: 1 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  isBlocked: { 
    type: Boolean, 
    default: false 
  },
  blockedUntil: { 
    type: Date 
  },
  blockDurationHours: { 
    type: Number, 
    default: 24 
  },
  ipAddress: { 
    type: String 
  },
  userAgent: { 
    type: String 
  },
  additionalInfo: {
    windowTitle: String,
    screenSize: String,
    browserInfo: String
  }
});

// Index for efficient queries
securityViolationSchema.index({ userId: 1, violationType: 1, timestamp: -1 });
securityViolationSchema.index({ userId: 1, isBlocked: 1, blockedUntil: 1 });
securityViolationSchema.index({ testAttemptId: 1, violationType: 1 });

// Method to check if user is currently blocked
securityViolationSchema.statics.isUserBlocked = async function(userId, violationType = 'tab_switch') {
  const violation = await this.findOne({
    userId,
    violationType,
    isBlocked: true,
    blockedUntil: { $gt: new Date() }
  }).sort({ blockedUntil: -1 });
  
  return violation;
};

// Method to get remaining block time
securityViolationSchema.statics.getRemainingBlockTime = async function(userId, violationType = 'tab_switch') {
  const violation = await this.isUserBlocked(userId, violationType);
  if (!violation) return null;
  
  const now = new Date();
  const remainingMs = violation.blockedUntil.getTime() - now.getTime();
  const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
  
  return {
    blockedUntil: violation.blockedUntil,
    remainingMs,
    remainingHours,
    violation
  };
};

module.exports = mongoose.model('SecurityViolation', securityViolationSchema);