const { User } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Helper to sign JWT
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] }
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get single user by ID (admin or self)
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update user (admin or self)
exports.updateUser = async (req, res) => {
  try {
    const updates = { ...req.body };
    // Prevent role/email change unless admin
    if (req.user.role !== 'admin') {
      delete updates.role;
      delete updates.email;
    }
    // If password is being updated, hash it
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 12);
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    await user.update(updates);
    const updatedUser = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete user (admin or self)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await user.destroy();
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get current logged-in user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update current logged-in user profile
exports.updateProfile = async (req, res) => {
  try {
    const updates = { ...req.body };
    // If password is being updated, hash it
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 12);
    }
    const user = await User.findByPk(req.user.id);
    await user.update(updates);
    const updatedUser = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const students = await User.count({ where: { role: 'student' } });
    const admins = await User.count({ where: { role: 'admin' } });
    const corporates = await User.count({ where: { role: 'corporate' } });
    const government = await User.count({ where: { role: 'government' } });

    res.status(200).json({
      status: 'success',
      data: {
        totalUsers,
        students,
        admins,
        corporates,
        government
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get user certificates (placeholder - implement based on your certificate model)
exports.getUserCertificates = async (req, res) => {
  try {
    // TODO: Implement certificate logic when certificate model is available
    res.status(200).json({
      status: 'success',
      data: []
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch user certificates' });
  }
};

// Get enrolled courses (placeholder - implement based on your enrollment model)
exports.getEnrolledCourses = async (req, res) => {
  try {
    // TODO: Implement enrollment logic when enrollment model is available
    res.status(200).json({
      status: 'success',
      data: []
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch enrolled courses' });
  }
};

// Get user achievements (placeholder - implement based on your achievement model)
exports.getUserAchievements = async (req, res) => {
  try {
    // TODO: Implement achievement logic when achievement model is available
    res.status(200).json({
      status: 'success',
      data: []
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch user achievements' });
  }
};

// Get user activity (placeholder - implement based on your activity model)
exports.getUserActivity = async (req, res) => {
  try {
    // TODO: Implement activity logic when activity model is available
    res.status(200).json({
      status: 'success',
      data: []
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch user activity' });
  }
};

// Update user profile (alias for updateUser)
exports.updateUserProfile = async (req, res) => {
  try {
    const updates = { ...req.body };
    // If password is being updated, hash it
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 12);
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    await user.update(updates);
    const updatedUser = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Toggle user active status (admin only)
exports.toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ 
        status: 'fail',
        message: 'User not found' 
      });
    }

    // Prevent admin from disabling themselves
    if (userId === req.user.id.toString()) {
      return res.status(400).json({
        status: 'fail',
        message: 'You cannot disable your own account'
      });
    }

    // Update user status
    const updatedUser = await User.findByPk(
      userId,
      { where: { isActive } }
    );

    res.status(200).json({
      status: 'success',
      message: `User ${isActive ? 'enabled' : 'disabled'} successfully`,
      data: {
        user: updatedUser
      }
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to update user status',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get user by student ID (for students)
exports.getUserByStudentId = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const user = await User.findOne({ where: { studentId } });
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'Student not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch student information'
    });
  }
};
