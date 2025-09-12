const { SecurityViolation, TestAttempt, PracticeTest, User } = require('../models');
const { sequelize } = require('../config/database');


exports.reportViolation = async (req, res) => {
  try {
    const { testAttemptId } = req.params;
    const { 
      violationType, 
      additionalInfo 
    } = req.body;

    
    const validTypes = ['tab_switch', 'window_switch', 'copy_paste', 'right_click', 'developer_tools'];
    if (!validTypes.includes(violationType)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid violation type'
      });
    }

    
    const testAttempt = await TestAttempt.findByPk(testAttemptId);
    if (!testAttempt || testAttempt.status !== 'in_progress') {
      return res.status(404).json({
        status: 'fail',
        message: 'Test attempt not found or not in progress'
      });
    }

    
    if (testAttempt.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to access this test attempt'
      });
    }

    
    const existingViolations = await SecurityViolation.findAll({
      where: {
        userId: req.user.id,
        testAttemptId,
        violationType: { [sequelize.Op.in]: ['tab_switch', 'window_switch'] }
      }
    });

    const violationCount = existingViolations.length + 1;

    
    const violation = await SecurityViolation.create({
      userId: req.user.id,
      testAttemptId,
      practiceTestId: testAttempt.practiceTestId,
      violationType,
      violationCount,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      additionalInfo: additionalInfo || {}
    });

    let shouldBlock = false;
    let blockedUntil = null;

    
    if (['tab_switch', 'window_switch'].includes(violationType) && violationCount >= 3) {
      shouldBlock = true;
      blockedUntil = new Date(Date.now() + (24 * 60 * 60 * 1000)); 
      
      
      violation.isBlocked = true;
      violation.blockedUntil = blockedUntil;
      violation.blockDurationHours = 24;
      await violation.save();

      
      await testAttempt.update({
        status: 'abandoned',
        completedAt: new Date()
      });
    }

    const response = {
      status: 'success',
      data: {
        violationCount,
        maxViolations: 3,
        violationType,
        shouldBlock,
        blockedUntil,
        warningMessage: violationCount < 3 ? 
          `Warning: ${violationCount}/3 violations detected. Tab/window switching is not allowed during tests.` :
          'Test terminated due to security violations. You are blocked from taking tests for 24 hours.'
      }
    };

    if (shouldBlock) {
      return res.status(403).json({
        ...response,
        status: 'fail',
        message: 'Test access blocked due to security violations'
      });
    }

    res.status(200).json(response);
  } catch (err) {
    console.error('Error in reportViolation:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to report security violation',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


exports.checkUserBlockStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    
    
    const blockInfo = null; 
    
    if (blockInfo) {
      return res.status(200).json({
        status: 'success',
        data: {
          isBlocked: true,
          blockedUntil: blockInfo.blockedUntil,
          remainingMs: blockInfo.remainingMs,
          remainingHours: blockInfo.remainingHours,
          violationType: blockInfo.violation.violationType,
          message: `You are blocked from taking tests until ${blockInfo.blockedUntil.toLocaleString()}`
        }
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        isBlocked: false,
        message: 'No active blocks'
      }
    });
  } catch (err) {
    console.error('Error in checkUserBlockStatus:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check block status'
    });
  }
};


exports.getUserViolationHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const violations = await SecurityViolation.findAll({
      where: { userId },
      include: [
        {
          model: PracticeTest,
          as: 'practiceTest',
          attributes: ['title']
        },
        {
          model: TestAttempt,
          as: 'testAttempt',
          attributes: ['startedAt', 'status']
        }
      ],
      order: [['timestamp', 'DESC']],
      limit: 50
    });

    res.status(200).json({
      status: 'success',
      data: { violations }
    });
  } catch (err) {
    console.error('Error in getUserViolationHistory:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch violation history'
    });
  }
};


exports.getAllViolations = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admins can view all violations'
      });
    }

    const { page = 1, limit = 50, violationType, isBlocked } = req.query;
    
    const filter = {};
    if (violationType) filter.violationType = violationType;
    if (isBlocked !== undefined) filter.isBlocked = isBlocked === 'true';

    const violations = await SecurityViolation.findAll({
      where: filter,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['firstName', 'lastName', 'email']
        },
        {
          model: PracticeTest,
          as: 'practiceTest',
          attributes: ['title']
        },
        {
          model: TestAttempt,
          as: 'testAttempt',
          attributes: ['startedAt', 'status']
        }
      ],
      order: [['timestamp', 'DESC']],
      limit: limit * 1,
      offset: (page - 1) * limit
    });

    const total = await SecurityViolation.count({ where: filter });

    res.status(200).json({
      status: 'success',
      data: {
        violations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    console.error('Error in getAllViolations:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch violations'
    });
  }
};


exports.unblockUser = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admins can unblock users'
      });
    }

    const { userId } = req.params;
    
    
    await SecurityViolation.update(
      {
        isBlocked: false,
        blockedUntil: new Date() 
      },
      {
        where: {
          userId,
          isBlocked: true,
          blockedUntil: { [sequelize.Op.gt]: new Date() }
        }
      }
    );

    res.status(200).json({
      status: 'success',
      message: 'User unblocked successfully'
    });
  } catch (err) {
    console.error('Error in unblockUser:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to unblock user'
    });
  }
};