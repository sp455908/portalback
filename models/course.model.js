const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  duration: { type: String, required: true },
  modules: { type: Number, required: true },
  fee: { type: String, required: true },
  isActive: { type: Boolean, default: false }, // Changed to match your frontend status
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  students: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true // This will automatically handle createdAt and updatedAt
});

courseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Course', courseSchema);