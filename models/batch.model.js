const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  batchId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  batchName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  assignedTests: [{
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PracticeTest',
      required: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    dueDate: {
      type: Date
    },
    instructions: {
      type: String,
      trim: true
    }
  }],
  settings: {
    maxStudents: {
      type: Number,
      default: 50,
      min: 1,
      max: 200
    },
    allowTestRetakes: {
      type: Boolean,
      default: false
    },
    requireCompletion: {
      type: Boolean,
      default: true
    },
    autoAssignTests: {
      type: Boolean,
      default: false
    },
    notificationSettings: {
      emailNotifications: {
        type: Boolean,
        default: true
      },
      testReminders: {
        type: Boolean,
        default: true
      },
      dueDateAlerts: {
        type: Boolean,
        default: true
      }
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'completed', 'archived'],
    default: 'active'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  tags: [{
    type: String,
    trim: true
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt on save
batchSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Generate unique batch ID before saving
batchSchema.pre('save', async function(next) {
  if (this.isNew && !this.batchId) {
    try {
      const year = new Date().getFullYear();
      const count = await mongoose.connection.db.collection('batches').countDocuments({
        batchId: { $regex: `^BATCH-${year}-` }
      });
      this.batchId = `BATCH-${year}-${String(count + 1).padStart(4, '0')}`;
    } catch (error) {
      // Fallback to timestamp if counting fails
      this.batchId = `BATCH-${year}-${Date.now()}`;
    }
  }
  next();
});

// Virtual for student count
batchSchema.virtual('studentCount').get(function() {
  return this.students.length;
});

// Virtual for active test count
batchSchema.virtual('activeTestCount').get(function() {
  return this.assignedTests.filter(test => test.isActive).length;
});

// Index for efficient queries
batchSchema.index({ batchId: 1 });
batchSchema.index({ adminId: 1 });
batchSchema.index({ status: 1 });
batchSchema.index({ 'students': 1 });

module.exports = mongoose.model('Batch', batchSchema); 