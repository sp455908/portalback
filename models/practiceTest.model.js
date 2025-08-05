const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: { type: [String], required: true },
  correctAnswer: { type: Number, required: true }, // index of correct option (0-3)
  explanation: { type: String }, // optional explanation for the answer
  category: { type: String }, // e.g., "customs", "freight", "documentation"
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  marks: { type: Number, default: 1 }
});

const practiceTestSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String },
  category: { type: String, required: true }, // e.g., "F Card", "G Card", "Customs Law"
  questions: { type: [questionSchema], required: true }, // 150-200 questions
  totalQuestions: { type: Number, required: true }, // total questions in bank
  questionsPerTest: { type: Number, default: 10 }, // questions shown per test
  duration: { type: Number, required: true }, // duration in minutes
  passingScore: { type: Number, default: 70 }, // passing percentage
  isActive: { type: Boolean, default: true },
  allowRepeat: { type: Boolean, default: false }, // admin can enable repeat
  repeatAfterHours: { type: Number, default: 24 }, // hours before repeat allowed
  enableCooldown: { type: Boolean, default: true }, // whether cooldown is enabled for this test
  showInPublic: { type: Boolean, default: false },
  targetUserType: { type: String, enum: ['student', 'corporate', 'government'], required: true, default: 'student' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

practiceTestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('PracticeTest', practiceTestSchema); 