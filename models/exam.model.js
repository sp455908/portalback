const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options:  { type: [String], required: true },
  correctAnswer: { type: Number, required: true }, // index of correct option
  marks: { type: Number, default: 1 }
});

const examSchema = new mongoose.Schema({
  title:        { type: String, required: true, trim: true },
  courseId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  date:         { type: Date, required: false },
  duration:     { type: String, required: true }, // e.g., "3 Hours"
  questions:    { type: [questionSchema], default: [] },
  description:  { type: String },
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fee:          { type: String },
  status:       { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
  targetUserType: { type: String, enum: ['student', 'corporate', 'government'], required: true },
  venue:        { type: String },
  passingScore: { type: Number, default: 0 },
  maxMarks:     { type: Number, default: 100 },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now }
});

examSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Exam', examSchema);