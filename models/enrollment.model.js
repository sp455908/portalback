const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  enrolledAt:{ type: Date, default: Date.now },
  status:    { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  progress:  { type: Number, default: 0 }, // percentage or module tracking
  certificateUrl: { type: String }, // optional: link to certificate if completed
  notes:     { type: String }
});

module.exports = mongoose.model('Enrollment', enrollmentSchema);