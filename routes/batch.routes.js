const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batch.controller');
const { protect } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');

// Student routes (for students to view their batches) - MUST BE FIRST
router.get('/student/:studentId', protect, authorize('student', 'corporate', 'government'), batchController.getStudentBatches);

// Temporary test endpoint (remove after testing)
router.get('/test', (req, res) => {
  res.json({ 
    status: 'success', 
    message: 'Batch routes are working',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint (no auth required)
router.get('/health', batchController.batchHealthCheck);

// Admin-only routes - MUST BE AFTER student routes
router.use(protect, authorize('admin'));

// Batch CRUD operations
router.post('/', batchController.createBatch);
router.get('/', batchController.getAllBatches);
router.get('/:batchId', batchController.getBatchById);
router.put('/:batchId', batchController.updateBatch);
router.delete('/:batchId', batchController.deleteBatch);

// Batch statistics (MUST come before parameterized routes)
router.get('/stats', protect, authorize('admin'), batchController.getDashboardStats);

// Individual batch statistics
router.get('/:batchId/stats', batchController.getBatchStats);

// Student management in batches
router.post('/:batchId/students', batchController.addStudentsToBatch);
router.delete('/:batchId/students', batchController.removeStudentsFromBatch);
router.get('/:batchId/students/check-conflicts', batchController.checkStudentsConflicts);
router.get('/:batchId/students/all-conflicts', batchController.getAllStudentConflicts);

// Test assignment in batches
router.post('/:batchId/tests', batchController.assignTestsToBatch);
router.delete('/:batchId/tests', batchController.removeTestsFromBatch);

module.exports = router; 