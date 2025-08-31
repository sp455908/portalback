const express = require('express');
const router = express.Router();
const courseController = require('../controllers/course.controller');
const { protect } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');

// Debug middleware to log all course route requests
router.use((req, res, next) => {
  console.log(`📚 Course Route: ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    params: req.params,
    body: req.body,
    user: req.user ? { id: req.user.id, role: req.user.role } : 'No user'
  });
  next();
});

// Create a new course (admin only)
router.post('/', protect, authorize('admin'), courseController.createCourse);

// Get all courses
router.get('/', courseController.getAllCourses);

// Get a single course by ID
router.get('/:id', courseController.getCourseById);

// Update a course (admin only)
router.put('/:id', protect, authorize('admin'), courseController.updateCourse);

// Delete a course (admin only)
router.delete('/:id', protect, authorize('admin'), courseController.deleteCourse);

module.exports = router;