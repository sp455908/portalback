const { Alert } = require('../models');


exports.createAlert = async (req, res) => {
  try {
    const {
      title,
      content,
      category,
      priority,
      date,
      impact,
      tags,
      isActive
    } = req.body;

    const alert = await Alert.create({
      title,
      content,
      category,
      priority,
      date,
      impact,
      tags,
      isActive
    });

    res.status(201).json(alert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.getAllAlerts = async (req, res) => {
  try {
    const alerts = await Alert.findAll({
      order: [['date', 'DESC']]
    });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.getAlertById = async (req, res) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    res.json(alert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.updateAlert = async (req, res) => {
  try {
    const allowedFields = [
      'title',
      'content',
      'category',
      'priority',
      'date',
      'impact',
      'tags',
      'isActive'
    ];

    const updates = {};
    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key];
      }
    }

    
    if (Object.prototype.hasOwnProperty.call(updates, 'isActive')) {
      updates.isActive = Boolean(updates.isActive);
    }

    const alert = await Alert.findByPk(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });

    await alert.update(updates);
    res.json(alert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.toggleAlertStatus = async (req, res) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });

    
    const hasIsActive = Object.prototype.hasOwnProperty.call(req.body, 'isActive');
    const nextIsActive = hasIsActive ? Boolean(req.body.isActive) : !alert.isActive;

    await alert.update({ isActive: nextIsActive });
    res.json(alert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.deleteAlert = async (req, res) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    await alert.destroy();
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    res.json({ message: 'Alert deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};