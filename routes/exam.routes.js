const express = require('express');
const router = express.Router();
const examController = require('../controllers/exam.controller');
const { protect } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');

// Create a new exam (admin only)
router.post('/', protect, authorize('admin'), examController.createExam);

// Get all exams
router.get('/', examController.getAllExams);

// Get a single exam by ID
router.get('/:id', examController.getExamById);

// Update an exam (admin only)
router.put('/:id', protect, authorize('admin'), examController.updateExam);

// Delete an exam (admin only)
router.delete('/:id', protect, authorize('admin'), examController.deleteExam);

module.exports = router;