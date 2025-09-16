const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');
const { User, UserSession, Owner } = require('../models');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

// Rate limiters
const ownerAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many authentication attempts. Please try again later.' }
});

const ownerMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many requests. Please slow down.' }
});

// Basic validators
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const normalizeEmail = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v);
const isValidEmail = (v) => typeof v === 'string' && /^(?=[^@]{1,64}@)[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const isStrongPassword = (v) => typeof v === 'string' && v.length >= 10 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v);
const sanitizeName = (v) => (typeof v === 'string' ? v.replace(/[\r\n\t<>]/g, '').trim() : v);

// Owner auth (email/password) → issues OWNER JWT
router.post('/auth/login', ownerAuthLimiter, async (req, res) => {
  try {
    let { email, password } = req.body || {};
    
    // Handle both encrypted and plain text credentials
    try {
      const encryptionService = require('../utils/encryption');
      
      // If credentials are encrypted, decrypt them
      if (email.startsWith('encrypted:') && password.startsWith('encrypted:')) {
        const decryptedEmail = encryptionService.safeDecrypt(email.replace('encrypted:', ''));
        const decryptedPassword = encryptionService.safeDecrypt(password.replace('encrypted:', ''));
        
        if (decryptedEmail && decryptedPassword) {
          email = decryptedEmail.toLowerCase().trim();
          password = decryptedPassword;
        } else {
          return res.status(400).json({
            status: 'fail',
            message: 'Invalid encrypted credentials format',
            code: 'INVALID_ENCRYPTION'
          });
        }
      } else {
        // Plain text credentials - normalize email
        email = email.toLowerCase().trim();
      }
    } catch (decryptError) {
      return res.status(400).json({
        status: 'fail',
        message: 'Failed to process credentials',
        code: 'CREDENTIAL_PROCESSING_FAILED'
      });
    }

    if (!isValidEmail(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ status: 'fail', message: 'Email and password required' });
    }
    const owner = await Owner.findOne({ where: { email: normalizeEmail(email), isActive: true } });
    if (!owner) {
      return res.status(401).json({ status: 'fail', message: 'Invalid credentials' });
    }
    const ok = await owner.comparePassword(password);
    if (!ok) {
      return res.status(401).json({ status: 'fail', message: 'Invalid credentials' });
    }
    await owner.update({ lastLoginAt: new Date() });
    const token = jwt.sign({ id: owner.id, type: 'owner' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.status(200).json({ status: 'success', data: { token } });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Login failed' });
  }
});

// All routes here require Owner (superadmin)
router.use(protect, (req, res, next) => {
  if (!req.user || req.user.isOwner !== true) {
    return res.status(403).json({ status: 'fail', message: 'Forbidden' });
  }
  next();
});

// List all admin users (owner-only)
router.get('/admins', async (req, res) => {
  try {
    const admins = await User.findAll({
      where: { role: 'admin' },
      attributes: ['id', 'firstName', 'lastName', 'email', 'isActive', 'createdAt', 'updatedAt']
    });
    return res.status(200).json({ status: 'success', data: { admins } });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch admins' });
  }
});

// Create an admin user (max 5 ACTIVE admins policy)
router.post('/admins', ownerMutationLimiter, async (req, res) => {
  try {
    // Enforce max 5 ACTIVE admin users
    const adminCount = await User.count({ where: { role: 'admin', isActive: true } });
    if (adminCount >= 5) {
      return res.status(409).json({ status: 'fail', message: 'Maximum of 5 admin users are allowed in the system.' });
    }

    const { firstName, lastName, email, password } = req.body || {};
    if (!isNonEmptyString(firstName) || !isNonEmptyString(lastName) || !isValidEmail(email) || !isStrongPassword(password)) {
      return res.status(400).json({ status: 'fail', message: 'Missing or invalid fields' });
    }
    const normalizedEmail = normalizeEmail(email);
    const existing = await User.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ status: 'fail', message: 'Email already in use' });
    }
    const admin = await User.create({
      firstName: sanitizeName(firstName),
      lastName: sanitizeName(lastName),
      email: normalizedEmail,
      password,
      role: 'admin',
      userType: 'student'
    });
    res.status(201).json({ status: 'success', data: { admin: { id: admin.id, email: admin.email } } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to create admin' });
  }
});

// Delete (safely deactivate/demote) an admin user by id
router.delete('/admins/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await User.findByPk(id);
    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({ status: 'fail', message: 'Admin not found' });
    }
    // Prevent deleting the last remaining ACTIVE admin
    const adminCount = await User.count({ where: { role: 'admin', isActive: true } });
    if (adminCount <= 1) {
      return res.status(400).json({ status: 'fail', message: 'Cannot delete the last admin user. At least one admin must remain.' });
    }
    // Kill all sessions for this admin before deactivation
    try { await UserSession.killAllUserSessions(admin.id); } catch (_) {}

    // Soft-delete pattern to avoid FK constraint issues:
    // - Demote role away from 'admin' so active admin counts and access stop
    // - Mark isActive=false to disable logins
    // Note: We purposefully do not hard-delete to preserve referential integrity
    admin.role = 'student';
    admin.userType = admin.userType || 'student';
    admin.isActive = false;
    await admin.save();

    res.status(200).json({ status: 'success', message: 'Admin deactivated' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to deactivate admin' });
  }
});

// Reset admin password
router.post('/admins/:id/reset-password', ownerMutationLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body || {};
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ status: 'fail', message: 'New password is required' });
    }
    const admin = await User.findByPk(id);
    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({ status: 'fail', message: 'Admin not found' });
    }
    admin.password = newPassword;
    await admin.save();
    res.status(200).json({ status: 'success', message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to reset password' });
  }
});

// Change admin password with current password verification
router.post('/admins/:id/change-password', ownerMutationLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body || {};
    if (!isNonEmptyString(currentPassword) || !isStrongPassword(newPassword)) {
      return res.status(400).json({ status: 'fail', message: 'Current and new password are required' });
    }
    const admin = await User.findByPk(id);
    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({ status: 'fail', message: 'Admin not found' });
    }
    const ok = await admin.comparePassword(currentPassword);
    if (!ok) {
      return res.status(400).json({ status: 'fail', message: 'Current password is incorrect' });
    }
    admin.password = newPassword;
    await admin.save();
    return res.status(200).json({ status: 'success', message: 'Password changed successfully' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to change password' });
  }
});

// Kill all active sessions for an admin
router.post('/admins/:id/kill-sessions', ownerMutationLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate admin ID parameter
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ status: 'fail', message: 'Invalid admin ID' });
    }
    
    const admin = await User.findByPk(parseInt(id));
    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({ status: 'fail', message: 'Admin not found' });
    }
    
    // Count active sessions before deactivation
    const activeSessions = await UserSession.findUserActiveSessions(admin.id);
    const sessionCount = activeSessions.length;
    
    if (sessionCount === 0) {
      return res.status(200).json({ 
        status: 'success', 
        message: 'No active sessions found', 
        data: { count: 0 } 
      });
    }
    
    // Kill all sessions for this admin using the dedicated method
    const killedCount = await UserSession.killAllUserSessions(admin.id);
    
    res.status(200).json({ 
      status: 'success', 
      message: 'Admin sessions terminated', 
      data: { count: killedCount } 
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to kill sessions' });
  }
});

module.exports = router;

