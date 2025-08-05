const express = require('express');
const router = express.Router();
const materialController = require('../controllers/material.controller');
const { protect } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');

// Create a new material (admin only)
router.post('/', protect, authorize('admin'), materialController.createMaterial);

// Get all materials
router.get('/', materialController.getAllMaterials);

// Get a single material by ID
router.get('/:id', materialController.getMaterialById);

// Update a material (admin only)
router.put('/:id', protect, authorize('admin'), materialController.updateMaterial);

// Delete a material (admin only)
router.delete('/:id', protect, authorize('admin'), materialController.deleteMaterial);

module.exports = router;