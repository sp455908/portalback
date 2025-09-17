const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');
const userController = require('../controllers/user.controller');
const { User } = require('../models');
const { Op, fn, col } = require('sequelize');
const { decryptRequestBody } = require('../middlewares/decrypt.middleware');
const { checkRegistrationEnabled } = require('../controllers/settings.controller');
const { verifyCSRFToken } = require('../middlewares/csrf.middleware');
const { authRateLimit } = require('../middlewares/rateLimit.middleware');

// Register a new user (respect platform setting). Only allows non-admin roles (enforced in controller)
router.post('/user-auth/register', checkRegistrationEnabled, decryptRequestBody, authController.register);
// Alias for frontend compatibility
router.post('/register', checkRegistrationEnabled, decryptRequestBody, authController.register);

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

// Login user with encryption support
router.post('/login', decryptRequestBody, authController.login);

// Refresh access token (CSRF protection disabled for now to fix login flow)
router.post('/refresh-token', authController.refreshToken);

// Initial admin creation endpoint (for Render deployment)
router.post('/create-initial-admin', authController.createInitialAdmin);

// Get current authenticated user
router.get('/me', protect, authController.getMe);

// Logout (optional, for client-side token removal) - CSRF protection disabled for now to fix logout flow
router.post('/logout', authRateLimit, protect, authController.logout);

// Validate session endpoint
router.get('/validate-session', authController.validateSession);

// Update session activity endpoint
router.post('/update-activity', authController.updateSessionActivity);

// Get user stats
router.get('/stats', protect, userController.getUserStats);

// Get active sessions for current user
router.get('/active-sessions', protect, authController.getActiveSessions);

// Force logout from all other sessions
router.post('/logout-all-other-sessions', protect, authController.logoutAllOtherSessions);

// Get user's active sessions
router.get('/sessions', protect, authController.getActiveSessions);

// Secure authentication status endpoint - returns user info if authenticated
router.get('/me', protect, (req, res) => {
  res.json({
    status: 'success',
    authenticated: true,
    data: {
      user: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
        isOwner: req.user.isOwner || false,
        isActive: req.user.isActive
      }
    }
  });
});

// Test endpoint to verify cookie setting (development only)
if (process.env.NODE_ENV === 'development') {
  router.get('/test-cookies', (req, res) => {
    res.cookie('test-cookie', 'test-value', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 60 * 1000 // 1 minute
    });
    
    res.json({
      status: 'success',
      message: 'Test cookie set',
      cookies: req.cookies,
      headers: {
        origin: req.headers.origin,
        'user-agent': req.headers['user-agent']
      }
    });
  });
}

// CSP reporting endpoint
router.post('/security/csp-report', (req, res) => {
  console.log('CSP Violation Report:', req.body);
  res.status(204).send();
});

module.exports = router;