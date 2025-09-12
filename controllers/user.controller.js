const { User, LoginAttempt } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize'); 


const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });


exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });

    
    const encryptionService = require('../utils/encryption');

    
    const usersWithBlockStatus = await Promise.all(
      users.map(async (user) => {
        const blockStatus = await LoginAttempt.isUserBlocked(user.id);
        const userJson = user.toJSON();
        
        
        let decryptedPhone = userJson.phone;
        if (userJson.phone && userJson.phone.trim() !== '') {
          decryptedPhone = encryptionService.safeDecrypt(String(userJson.phone));
        }
        
        return {
          ...userJson,
          phone: decryptedPhone,
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


exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });
    if (!user) {
      return res.status(404).json({ 
        status: 'fail',
        message: 'User not found' 
      });
    }

    
    const encryptionService = require('../utils/encryption');
    const userJson = user.toJSON();
    const decryptedUser = {
      ...userJson,
      phone: userJson.phone ? encryptionService.safeDecrypt(String(userJson.phone)) : userJson.phone
    };

    res.status(200).json({
      status: 'success',
      data: { user: decryptedUser }
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch user',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const updates = { ...req.body };

    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }

    
    // Hardened: Never allow elevating to admin via this endpoint
    if (updates.role && updates.role !== user.role) {
      if (updates.role === 'admin' || updates.role === 'owner') {
        return res.status(403).json({
          status: 'fail',
          message: 'Role elevation to admin/owner is not allowed via API'
        });
      }
    }

    if (updates.role === 'admin' && user.role !== 'admin') {
      const adminCount = await User.count({ 
        where: { 
          role: 'admin',
          id: { [Op.ne]: userId } 
        } 
      });
      if (adminCount > 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'Only one admin user is allowed in the system. Cannot create additional admin users.'
        });
      }
    }

    
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 12);
    }

    
    await user.update(updates);

    
    const updatedUser = await User.findByPk(userId, {
      attributes: { exclude: ['password'] }
    });

    res.status(200).json({
      status: 'success',
      message: 'User updated successfully',
      data: { user: updatedUser }
    });
  } catch (err) {
    console.error('Error updating user:', err);
    
    
    if (err.message === 'Only one admin user is allowed in the system') {
      return res.status(400).json({
        status: 'fail',
        message: err.message
      });
    }

    
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({
        status: 'fail',
        message: 'Validation error',
        errors: err.errors.map(e => ({
          field: e.path,
          message: e.message
        }))
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to update user',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ 
        status: 'fail',
        message: 'User not found' 
      });
    }

    
    if (user.role === 'admin') {
      const adminCount = await User.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        return res.status(400).json({
          status: 'fail',
          message: 'Cannot delete the last admin user. At least one admin must remain in the system.'
        });
      }
    }

    
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({
        status: 'fail',
        message: 'You cannot delete your own account. Please contact another administrator.'
      });
    }

    
    const { Course } = require('../models');
    const instructorCourses = await Course.count({ where: { instructorId: userId } });
    if (instructorCourses > 0) {
      return res.status(400).json({
        status: 'fail',
        message: `Cannot delete user because they are an instructor of ${instructorCourses} course(s). Please reassign or delete the courses first.`
      });
    }

    
    const { 
      Enrollment, 
      Application, 
      TestAttempt, 
      UserTestCooldown, 
      SecurityViolation, 
      LoginAttempt,
      BatchStudent 
    } = require('../models');

    
    await Promise.all([
      Enrollment.destroy({ where: { userId: userId } }),
      Application.destroy({ where: { userId: userId } }),
      TestAttempt.destroy({ where: { userId: userId } }),
      UserTestCooldown.destroy({ where: { userId: userId } }),
      SecurityViolation.destroy({ where: { userId: userId } }),
      LoginAttempt.destroy({ where: { userId: userId } }),
      BatchStudent.destroy({ where: { userId: userId } })
    ]);

    
    await user.destroy();

    res.status(200).json({ 
      status: 'success',
      message: 'User deleted successfully' 
    });
  } catch (err) {
    console.error('Error deleting user:', err);
    
    
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot delete user because they have related data (enrollments, applications, etc.). Please remove related data first or contact support.'
      });
    }
    
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to delete user',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User profile not found'
      });
    }

    
    const encryptionService = require('../utils/encryption');
    const userJson = user.toJSON();
    const decryptedUser = {
      ...userJson,
      phone: userJson.phone ? encryptionService.safeDecrypt(String(userJson.phone)) : userJson.phone
    };

    res.status(200).json({
      status: 'success',
      data: { user: decryptedUser }
    });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch profile',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


exports.updateProfile = async (req, res) => {
  try {
    const updates = { ...req.body };
    
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 12);
    }
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User profile not found'
      });
    }
    await user.update(updates);
    const updatedUser = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    
    let userForResponse = updatedUser && typeof updatedUser.toJSON === 'function' ? updatedUser.toJSON() : updatedUser;
    try {
      const encryptionService = require('../utils/encryption');
      if (userForResponse && userForResponse.phone) {
        userForResponse = { ...userForResponse, phone: encryptionService.safeDecrypt(String(userForResponse.phone)) };
      }
    } catch (_) { /* ignore */ }

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: { user: userForResponse }
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
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


exports.getUserCertificates = async (req, res) => {
  try {
    
    res.status(200).json({
      status: 'success',
      data: []
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch user certificates' });
  }
};


exports.getEnrolledCourses = async (req, res) => {
  try {
    
    res.status(200).json({
      status: 'success',
      data: []
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch enrolled courses' });
  }
};


exports.getUserAchievements = async (req, res) => {
  try {
    
    res.status(200).json({
      status: 'success',
      data: []
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch user achievements' });
  }
};


exports.getUserActivity = async (req, res) => {
  try {
    
    res.status(200).json({
      status: 'success',
      data: []
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch user activity' });
  }
};


exports.updateUserProfile = async (req, res) => {
  try {
    const updates = { ...req.body };
    
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


exports.getBlockedUsers = async (req, res) => {
  try {
    const blockedUsers = await LoginAttempt.findAll({
      where: {
        isBlocked: true,
        [Op.or]: [
          
          {
            blockedUntil: {
              [Op.gt]: new Date()
            }
          },
          
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


exports.unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }

    
    const blockedAttempt = await LoginAttempt.isUserBlocked(userId);
    if (!blockedAttempt) {
      return res.status(400).json({
        status: 'fail',
        message: 'User is not currently blocked'
      });
    }

    
    await LoginAttempt.unblockUser(userId, req.user.id);

    
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


exports.blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, blockDuration } = req.body;

    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }

    
    const alreadyBlocked = await LoginAttempt.isUserBlocked(userId);
    if (alreadyBlocked) {
      return res.status(400).json({
        status: 'fail',
        message: 'User is already blocked'
      });
    }

    
    if (user.role === 'admin') {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot block admin users'
      });
    }

    
    if (userId === req.user.id) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot block your own account'
      });
    }

    
    let blockedUntil = null;
    if (blockDuration) {
      
      blockedUntil = new Date(Date.now() + blockDuration * 60 * 1000);
    }
    

    blockedUntil = await LoginAttempt.manuallyBlockUser(
      userId, 
      user.email, 
      reason || 'Manually blocked by administrator', 
      blockDuration
    );

    
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


exports.getUserLoginAttempts = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }

    
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
