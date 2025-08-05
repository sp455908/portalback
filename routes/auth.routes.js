const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');
const userController = require('../controllers/user.controller');

// Register a new user
router.post('/user-auth/register', authController.register);
// Alias for frontend compatibility
router.post('/register', authController.register);
// Add this to auth.routes.js
router.post('/verify-token', protect, (req, res) => {
  res.status(200).json({ valid: true, user: req.user });
});
// Login user
router.post('/login', authController.login);

// Get current authenticated user
router.get('/me', protect, authController.getMe);

// Logout (optional, for client-side token removal)
router.post('/logout', protect, authController.logout);
router.get('/stats', protect, userController.getUserStats);
module.exports = router;