const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

// Get maintenance status (public endpoint) - no auth required
router.get('/maintenance-status', settingsController.getMaintenanceStatus);

// Get settings (admin only)
router.get('/', authMiddleware.protect, roleMiddleware('admin'), settingsController.getSettings);

// Update settings (admin only)
router.put('/', authMiddleware.protect, roleMiddleware('admin'), settingsController.updateSettings);

// Reset settings to defaults (admin only)
router.post('/reset', authMiddleware.protect, roleMiddleware('admin'), settingsController.resetSettings);

module.exports = router; 