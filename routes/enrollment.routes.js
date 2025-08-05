const express = require('express');
const router = express.Router();
const enrollmentController = require('../controllers/enrollment.controller');
const { protect } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');

// Enroll in a course (student)
router.post('/', protect, authorize('student'), enrollmentController.createEnrollment);

// Get all enrollments (admin only)
router.get('/', protect, authorize('admin'), enrollmentController.getAllEnrollments);

// Update enrollment (admin only)
router.put('/:id', protect, authorize('admin'), enrollmentController.updateEnrollment);

// Get current user's enrollments
router.get('/my-enrollments', protect, enrollmentController.getMyEnrollments);

module.exports = router;