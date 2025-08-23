const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { protect } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');

// Admin-only analytics routes
router.use(protect, authorize('admin'));

// Overview + list with pagination and filters
router.get('/students-progress', analyticsController.getStudentsProgress);

// Detailed per-student view
router.get('/student/:userId/progress', analyticsController.getStudentProgressDetail);

// Overview analytics for Analytics page
router.get('/overview', analyticsController.getOverviewAnalytics);

module.exports = router;

