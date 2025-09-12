const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');
const { User, UserSession, Owner } = require('../models');
const jwt = require('jsonwebtoken');

// Owner auth (email/password) → issues OWNER JWT
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ status: 'fail', message: 'Email and password required' });
    }
    const owner = await Owner.findOne({ where: { email: String(email).toLowerCase().trim(), isActive: true } });
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

// Create an admin user
router.post('/admins', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ status: 'fail', message: 'Missing required fields' });
    }
    const existing = await User.findOne({ where: { email: String(email).toLowerCase().trim() } });
    if (existing) {
      return res.status(409).json({ status: 'fail', message: 'Email already in use' });
    }
    const admin = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: 'admin',
      userType: 'student' // userType is required by model; admin userType is not used for access
    });
    res.status(201).json({ status: 'success', data: { admin: { id: admin.id, email: admin.email } } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to create admin' });
  }
});

// Delete an admin user by id
router.delete('/admins/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await User.findByPk(id);
    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({ status: 'fail', message: 'Admin not found' });
    }
    await admin.destroy();
    res.status(200).json({ status: 'success', message: 'Admin deleted' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to delete admin' });
  }
});

// Reset admin password
router.post('/admins/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword) {
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
router.post('/admins/:id/change-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
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
router.post('/admins/:id/kill-sessions', async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await User.findByPk(id);
    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({ status: 'fail', message: 'Admin not found' });
    }
    const sessions = await UserSession.findUserActiveSessions(admin.id);
    await Promise.all(sessions.map(s => s.update({ isActive: false })));
    res.status(200).json({ status: 'success', message: 'Admin sessions terminated', data: { count: sessions.length } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to kill sessions' });
  }
});

module.exports = router;

