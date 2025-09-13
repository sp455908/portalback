const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/application.controller');
const { protect } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');
const { decryptRequestBody } = require('../middlewares/decrypt.middleware');

// Create a new application (any user or guest)
router.post('/', decryptRequestBody, applicationController.createApplication);

// Get all applications (admin or owner)
router.get('/', protect, authorize('admin', 'owner'), applicationController.getAllApplications);

// Get applications for current user
router.get('/me', protect, applicationController.getMyApplications);

// Get application by ID (admin or owner)
router.get('/:id', protect, applicationController.getApplicationById);

// Update application status (admin only)
router.patch('/:id/status', protect, authorize('admin'), applicationController.updateApplicationStatus);

// Delete application (admin only)
router.delete('/:id', protect, authorize('admin'), applicationController.deleteApplication);

module.exports = router;