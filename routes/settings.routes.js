const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { protect } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');

// Get all settings (admin only)
router.get('/', protect, authorize('admin'), settingsController.getSettings);

// Get maintenance status (public)
router.get('/maintenance-status', settingsController.getMaintenanceStatus);

// Get single admin status (public)
router.get('/single-admin-status', settingsController.getSingleAdminStatus);

// Update settings (admin only)
router.put('/', protect, authorize('admin'), settingsController.updateSettings);

module.exports = router; 