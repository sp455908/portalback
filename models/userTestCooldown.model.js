const mongoose = require('mongoose');

const userTestCooldownSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  testId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'PracticeTest', 
    required: true 
  },
  cooldownHours: { 
    type: Number, 
    required: true, 
    default: 24 
  },
  setBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  setAt: { 
    type: Date, 
    default: Date.now 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
});

// Compound index to ensure unique user-test combinations
userTestCooldownSchema.index({ userId: 1, testId: 1 }, { unique: true });

module.exports = mongoose.model('UserTestCooldown', userTestCooldownSchema); 