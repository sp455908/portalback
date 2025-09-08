const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alert.controller');

const { protect } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');

// Create a new alert (admin only)
router.post('/', protect, authorize('admin'), alertController.createAlert);

// Get all alerts (public)
router.get('/', alertController.getAllAlerts);

// Get a single alert by ID (public)
router.get('/:id', alertController.getAlertById);

// Update an alert (admin only)
router.put('/:id', protect, authorize('admin'), alertController.updateAlert);

// Toggle alert active status (admin only)
router.patch('/:id/toggle', protect, authorize('admin'), alertController.toggleAlertStatus);

// Delete an alert (admin only)
router.delete('/:id', protect, authorize('admin'), alertController.deleteAlert);

module.exports = router;