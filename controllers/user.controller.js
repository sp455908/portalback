const { User, LoginAttempt } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize'); // Added Op for the new updateUser function

// Helper to sign JWT
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });

    // Get blocking status for each user
    const usersWithBlockStatus = await Promise.all(
      users.map(async (user) => {
        const blockStatus = await LoginAttempt.isUserBlocked(user.id);
        return {
          ...user.toJSON(),
          isBlocked: !!blockStatus,
          blockedUntil: blockStatus?.blockedUntil || null,
          blockReason: blockStatus?.blockReason || null
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: {
        users: usersWithBlockStatus,
        total: usersWithBlockStatus.length
      }
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch users',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
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
    const { userId } = req.params;
    const updates = req.body;

    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }

    // Check single admin rule when updating role to admin
    if (updates.role === 'admin' && user.role !== 'admin') {
      const adminCount = await User.count({ 
        where: { 
          role: 'admin',
          id: { [Op.ne]: userId } // Exclude current user
        } 
      });
      if (adminCount > 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'Only one admin user is allowed in the system. Cannot create additional admin users.'
        });
      }
    }

    // Update user
    await user.update(updates);

    res.status(200).json({
      status: 'success',
      message: 'User updated successfully',
      data: { user }
    });
  } catch (err) {
    console.error('Error updating user:', err);
    
    // Handle single admin rule violation
    if (err.message === 'Only one admin user is allowed in the system') {
      return res.status(400).json({
        status: 'fail',
        message: err.message
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to update user'
    });
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
    const activeUsers = await User.count({ where: { isActive: true } });
    const inactiveUsers = await User.count({ where: { isActive: false } });

    // Calculate percentages
    const activePercentage = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0;
    const inactivePercentage = totalUsers > 0 ? Math.round((inactiveUsers / totalUsers) * 100) : 0;
    const studentPercentage = totalUsers > 0 ? Math.round((students / totalUsers) * 100) : 0;
    const adminPercentage = totalUsers > 0 ? Math.round((admins / totalUsers) * 100) : 0;
    const corporatePercentage = totalUsers > 0 ? Math.round((corporates / totalUsers) * 100) : 0;
    const governmentPercentage = totalUsers > 0 ? Math.round((government / totalUsers) * 100) : 0;

    res.status(200).json({
      status: 'success',
      data: {
        totalUsers,
        students,
        admins,
        corporates,
        government,
        activeUsers,
        inactiveUsers,
        percentages: {
          students: studentPercentage,
          admins: adminPercentage,
          corporates: corporatePercentage,
          government: governmentPercentage,
          active: activePercentage,
          inactive: inactivePercentage
        }
      }
    });
  } catch (err) {
    console.error('Error fetching user stats:', err);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch user statistics',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
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

// Get all blocked users (admin only)
exports.getBlockedUsers = async (req, res) => {
  try {
    const blockedUsers = await LoginAttempt.findAll({
      where: {
        isBlocked: true,
        [Op.or]: [
          // Temporary blocks (with expiration)
          {
            blockedUntil: {
              [Op.gt]: new Date()
            }
          },
          // Permanent blocks (no expiration)
          {
            blockedUntil: null
          }
        ]
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'userType']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Group by user and get the latest block info
    const userMap = new Map();
    blockedUsers.forEach(attempt => {
      if (!userMap.has(attempt.userId.toString())) {
        const isPermanent = !attempt.blockedUntil;
        const remainingMinutes = isPermanent ? null : 
          Math.ceil((new Date(attempt.blockedUntil) - new Date()) / (1000 * 60));
        
        userMap.set(attempt.userId.toString(), {
          userId: attempt.userId,
          user: attempt.user,
          blockedUntil: attempt.blockedUntil,
          blockReason: attempt.blockReason,
          remainingMinutes: remainingMinutes,
          isPermanent: isPermanent,
          blockedAt: attempt.createdAt
        });
      }
    });

    const blockedUsersList = Array.from(userMap.values());

    res.status(200).json({
      status: 'success',
      data: {
        blockedUsers: blockedUsersList,
        total: blockedUsersList.length
      }
    });
  } catch (err) {
    console.error('Error fetching blocked users:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch blocked users'
    });
  }
};

// Unblock a user (admin only)
exports.unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }

    // Check if user is actually blocked
    const blockedAttempt = await LoginAttempt.isUserBlocked(userId);
    if (!blockedAttempt) {
      return res.status(400).json({
        status: 'fail',
        message: 'User is not currently blocked'
      });
    }

    // Unblock the user
    await LoginAttempt.unblockUser(userId, req.user.id);

    // Set user as active when unblocked
    await user.update({ isActive: true });

    res.status(200).json({
      status: 'success',
      message: 'User unblocked successfully and marked as active',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isActive: true
        }
      }
    });
  } catch (err) {
    console.error('Error unblocking user:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to unblock user'
    });
  }
};

// Block a user manually (admin only) - no time limit
exports.blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, blockDuration } = req.body;

    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }

    // Check if user is already blocked
    const alreadyBlocked = await LoginAttempt.isUserBlocked(userId);
    if (alreadyBlocked) {
      return res.status(400).json({
        status: 'fail',
        message: 'User is already blocked'
      });
    }

    // Check if trying to block admin user
    if (user.role === 'admin') {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot block admin users'
      });
    }

    // Check if trying to block yourself
    if (userId === req.user.id) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot block your own account'
      });
    }

    // Create block record
    let blockedUntil = null;
    if (blockDuration) {
      // If blockDuration is provided, calculate expiration
      blockedUntil = new Date(Date.now() + blockDuration * 60 * 1000);
    }
    // If blockDuration is null/undefined, user is blocked indefinitely

    blockedUntil = await LoginAttempt.manuallyBlockUser(
      userId, 
      user.email, 
      reason || 'Manually blocked by administrator', 
      blockDuration
    );

    // Update user status to inactive
    await user.update({ isActive: false });

    res.status(200).json({
      status: 'success',
      message: 'User blocked successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        },
        blockedUntil: blockedUntil,
        isPermanent: !blockedUntil,
        blockReason: reason || 'Manually blocked by administrator'
      }
    });
  } catch (err) {
    console.error('Error blocking user:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to block user'
    });
  }
};

// Get user login attempts (admin only)
exports.getUserLoginAttempts = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }

    // Get recent login attempts
    const attempts = await LoginAttempt.findAll({
      where: { userId },
      order: [['attemptTime', 'DESC']],
      limit: parseInt(limit),
      attributes: [
        'id', 'success', 'attemptTime', 'ipAddress', 'userAgent',
        'isBlocked', 'blockedUntil', 'blockReason'
      ]
    });

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        },
        attempts,
        total: attempts.length
      }
    });
  } catch (err) {
    console.error('Error fetching user login attempts:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user login attempts'
    });
  }
};
