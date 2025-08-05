const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  firstName: { type: String, required: true, trim: true },
  lastName:  { type: String, required: true, trim: true },
  email:     { type: String, required: true, trim: true },
  phone:     { type: String, required: true, trim: true },
  dateOfBirth: { type: String, required: false },
  gender:    { type: String, enum: ['male', 'female', 'other'], required: false },
  address:   { type: String, required: true },
  city:      { type: String, required: true },
  state:     { type: String, required: true },
  pincode:   { type: String, required: true },
  country:   { type: String, default: "India" },
  qualification: { type: String, required: true },
  institution:   { type: String, required: true },
  yearOfPassing: { type: String, required: true },
  percentage:    { type: String, required: true },
  selectedCourse: { type: String, required: true }, // or ObjectId if referencing Course
  preferredSchedule: { type: String, required: false },
  workExperience: { type: String, required: false },
  motivation:     { type: String, required: false },
  documentsUploaded: { type: Boolean, default: false },
  agreeTerms:    { type: Boolean, required: true },
  agreeMarketing:{ type: Boolean, default: false },
  status:        { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  notes:         { type: String },
  submittedAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('Application', applicationSchema);