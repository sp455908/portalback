const { Alert } = require('../models');

// Create a new alert (admin only)
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

// Get all alerts (public)
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

// Get a single alert by ID (public)
exports.getAlertById = async (req, res) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    res.json(alert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update an alert (admin only)
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

    // Coerce isActive to boolean if present
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

// Toggle alert active status (admin only)
exports.toggleAlertStatus = async (req, res) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });

    // If isActive provided, set explicitly; otherwise toggle
    const hasIsActive = Object.prototype.hasOwnProperty.call(req.body, 'isActive');
    const nextIsActive = hasIsActive ? Boolean(req.body.isActive) : !alert.isActive;

    await alert.update({ isActive: nextIsActive });
    res.json(alert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete an alert (admin only)
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