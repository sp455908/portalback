const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');

// ✅ GET user stats FIRST to avoid conflict with /:id
router.get('/stats', protect, userController.getUserStats);

// Get all users (admin only)
router.get('/', protect, userController.getAllUsers);

// Get user by ID (admin or self)
router.get('/:id', protect, userController.getUserById);

// Update user by ID (admin or self)
router.put('/:id', protect, userController.updateUser);

// Delete user by ID (admin or self)
router.delete('/:id', protect, userController.deleteUser);

// Get current user's profile
router.get('/me/profile', protect, userController.getProfile);

// Update current user's profile
router.put('/me/profile', protect, userController.updateProfile);

// New endpoints for dashboard functionality
router.get('/:id/certificates', protect, userController.getUserCertificates);
router.get('/:id/courses', protect, userController.getEnrolledCourses);
router.get('/:id/achievements', protect, userController.getUserAchievements);
router.get('/:id/activity', protect, userController.getUserActivity);
router.put('/:id/profile', protect, userController.updateUserProfile);

// Admin-only endpoints for user management
router.patch('/:userId/status', protect, authorize('admin'), userController.toggleUserStatus);
router.get('/student/:studentId', protect, userController.getUserByStudentId);

module.exports = router;