const mongoose = require('mongoose');

const testAttemptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  guestName: { type: String }, // for guest users
  guestEmail: { type: String }, // for guest users
  practiceTestId: { type: mongoose.Schema.Types.ObjectId, ref: 'PracticeTest', required: true },
  testTitle: { type: String, required: true },
  answers: [{
    questionIndex: { type: Number, required: true },
    selectedAnswer: { type: Number, required: true }, // index of selected option
    isCorrect: { type: Boolean, required: true },
    timeSpent: { type: Number, default: 0 } // time spent on this question in seconds
  }],
  questionsAsked: [{ type: Number }], // indices of questions that were shown
  score: { type: Number, default: 0 }, // percentage score - set to 0 initially
  totalQuestions: { type: Number, required: true },
  correctAnswers: { type: Number, default: 0 }, // set to 0 initially
  wrongAnswers: { type: Number, default: 0 }, // set to 0 initially
  timeTaken: { type: Number, default: 0 }, // total time taken in seconds - set to 0 initially
  maxTime: { type: Number, required: true }, // max time allowed in seconds
  startedAt: { type: Date, required: true },
  completedAt: { type: Date }, // optional - only set when completed
  status: { 
    type: String, 
    enum: ['in_progress', 'completed', 'timeout', 'abandoned'], 
    default: 'in_progress' 
  },
  passed: { type: Boolean, default: false }, // set to false initially
  ipAddress: { type: String }, // for security tracking
  userAgent: { type: String }, // for security tracking
  attemptsCount: { type: Number, default: 1 }, // which attempt this is for this user
  createdAt: { type: Date, default: Date.now }
});

// Index for efficient queries
testAttemptSchema.index({ userId: 1, practiceTestId: 1, createdAt: -1 });
testAttemptSchema.index({ userId: 1, startedAt: 1 });

module.exports = mongoose.model('TestAttempt', testAttemptSchema); 