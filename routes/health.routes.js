const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');

// Basic health check
router.get('/', healthController.healthCheck);

// Detailed health check with database status
router.get('/detailed', healthController.detailedHealthCheck);

module.exports = router;