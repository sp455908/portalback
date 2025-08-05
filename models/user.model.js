const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName:  { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true },
  role:      { type: String, enum: ['student', 'admin', 'corporate', 'government'], required: true },
  userType:  { type: String, enum: ['student', 'corporate', 'government'], required: true },
  phone:     { type: String, trim: true },
  address:   { type: String, trim: true },
  profileImage: { type: String }, // URL to profile image (optional)
  studentId: { type: String, unique: true, sparse: true }, // Unique student ID for students only
  isActive:  { type: Boolean, default: true }, // Enable/disable user access
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Generate unique student ID before saving
userSchema.pre('save', async function(next) {
  if (this.isNew && this.role === 'student' && !this.studentId) {
    // Generate student ID: IIFTL-YYYY-XXXXX (e.g., IIFTL-2024-00001)
    const year = new Date().getFullYear();
    const count = await mongoose.model('User').countDocuments({ 
      role: 'student', 
      studentId: { $regex: `^IIFTL-${year}-` } 
    });
    this.studentId = `IIFTL-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Update updatedAt on save
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Password comparison method
userSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);