const { Material, Course } = require('../models');


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


exports.getAllMaterials = async (req, res) => {
  try {
    const { courseId } = req.query;
    let query = {};
    
    if (courseId) {
      query.courseId = courseId;
    }
    
    const materials = await Material.findAll({
      where: query,
      include: [{
        model: Course,
        as: 'course',
        attributes: ['title']
      }],
      order: [['createdAt', 'DESC']]
    });
    
    res.json(materials);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.getMaterialById = async (req, res) => {
  try {
    const material = await Material.findByPk(req.params.id, {
      include: [{
        model: Course,
        as: 'course',
        attributes: ['title']
      }]
    });
    if (!material) return res.status(404).json({ message: 'Material not found' });
    res.json(material);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.updateMaterial = async (req, res) => {
  try {
    const updates = { ...req.body };
    const material = await Material.findByPk(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    await material.update(updates);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    res.json(material);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.deleteMaterial = async (req, res) => {
  try {
    const material = await Material.findByPk(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    await material.destroy();
    if (!material) return res.status(404).json({ message: 'Material not found' });
    res.json({ message: 'Material deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};