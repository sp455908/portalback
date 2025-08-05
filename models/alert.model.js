const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  title:      { type: String, required: true, trim: true },
  content:    { type: String, required: true },
  category:   { type: String, required: true }, // e.g., Policy Update, Tax Update, Documentation, etc.
  priority:   { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  date:       { type: Date, default: Date.now },
  impact:     { type: String },
  tags:       { type: [String], default: [] },
  isActive:   { type: Boolean, default: true },
  createdAt:  { type: Date, default: Date.now },
  updatedAt:  { type: Date, default: Date.now }
});

alertSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Alert', alertSchema);