const Material = require('../models/material.model');

// Create a new material (admin only)
exports.createMaterial = async (req, res) => {
  try {
    const { title, description, type, fileUrl, courseId, isActive } = req.body;
    
    const material = await Material.create({
      title,
      description,
      type,
      fileUrl,
      courseId,
      isActive: isActive || true
    });

    res.status(201).json(material);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all materials (optionally filter by course)
exports.getAllMaterials = async (req, res) => {
  try {
    const { courseId } = req.query;
    let query = {};
    
    if (courseId) {
      query.courseId = courseId;
    }
    
    const materials = await Material.find(query)
      .populate('courseId', 'title')
      .sort({ createdAt: -1 });
    
    res.json(materials);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get a single material by ID
exports.getMaterialById = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id)
      .populate('courseId', 'title');
    if (!material) return res.status(404).json({ message: 'Material not found' });
    res.json(material);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update a material (admin only)
exports.updateMaterial = async (req, res) => {
  try {
    const updates = { ...req.body };
    const material = await Material.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!material) return res.status(404).json({ message: 'Material not found' });
    res.json(material);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete a material (admin only)
exports.deleteMaterial = async (req, res) => {
  try {
    const material = await Material.findByIdAndDelete(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    res.json({ message: 'Material deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};