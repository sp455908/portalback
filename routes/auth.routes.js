const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');
const userController = require('../controllers/user.controller');
const { User } = require('../models');

// Register a new user
router.post('/user-auth/register', authController.register);
// Alias for frontend compatibility
router.post('/register', authController.register);

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

    const existingUser = await User.findOne({ where: { email } });
    
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
router.post('/login', authController.login);

// Initial admin creation endpoint (for Render deployment)
router.post('/create-initial-admin', authController.createInitialAdmin);

// Get current authenticated user
router.get('/me', protect, authController.getMe);

// Logout (optional, for client-side token removal)
router.post('/logout', protect, authController.logout);
router.get('/stats', protect, userController.getUserStats);
module.exports = router;