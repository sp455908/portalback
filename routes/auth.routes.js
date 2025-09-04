const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');
const userController = require('../controllers/user.controller');
const { User } = require('../models');
const { Op, fn, col } = require('sequelize');
const { decryptRequestBody } = require('../middlewares/decrypt.middleware');

// Register a new user
router.post('/user-auth/register', decryptRequestBody, authController.register);
// Alias for frontend compatibility
router.post('/register', decryptRequestBody, authController.register);

// Check if email exists
router.get('/check-email', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email parameter is required'
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({
      where: {
        email: normalizedEmail
      }
    });
    
    res.status(200).json({
      status: 'success',
      exists: !!existingUser,
      message: existingUser ? 'Email already registered' : 'Email available'
    });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while checking email',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Verify token endpoint
router.post('/verify-token', protect, (req, res) => {
  res.status(200).json({ valid: true, user: req.user });
});

// Login user
router.post('/login', decryptRequestBody, authController.login);

// Refresh access token
router.post('/refresh-token', authController.refreshToken);

// Initial admin creation endpoint (for Render deployment)
router.post('/create-initial-admin', authController.createInitialAdmin);

// Get current authenticated user
router.get('/me', protect, authController.getMe);

// Logout (optional, for client-side token removal)
router.post('/logout', protect, authController.logout);

// Validate session endpoint
router.get('/validate-session', authController.validateSession);

// Get user stats
router.get('/stats', protect, userController.getUserStats);

// Get active sessions for current user
router.get('/active-sessions', protect, authController.getActiveSessions);

// Force logout from all other sessions
router.post('/logout-all-other-sessions', protect, authController.logoutAllOtherSessions);

module.exports = router;