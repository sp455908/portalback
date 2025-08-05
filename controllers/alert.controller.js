const Alert = require('../models/alert.model');

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
    const alerts = await Alert.find().sort({ date: -1 });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get a single alert by ID (public)
exports.getAlertById = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    res.json(alert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update an alert (admin only)
exports.updateAlert = async (req, res) => {
  try {
    const updates = { ...req.body };
    const alert = await Alert.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    res.json(alert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete an alert (admin only)
exports.deleteAlert = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndDelete(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    res.json({ message: 'Alert deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};