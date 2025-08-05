const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  courseId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title:       { type: String, required: true, trim: true },
  description: { type: String },
  fileUrl:     { type: String, required: true },
  type:        { type: String, enum: ['pdf', 'video', 'image', 'document', 'archive', 'other'], default: 'other' },
  size:        { type: String }, // e.g., "2.4 MB"
  uploadedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadDate:  { type: Date, default: Date.now },
  downloads:   { type: Number, default: 0 },
  category:    { type: String }, // e.g., "lecture", "template", "resources"
  tags:        { type: [String], default: [] }
});

module.exports = mongoose.model('Material', materialSchema);