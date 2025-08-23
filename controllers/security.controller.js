const SecurityViolation = require('../models/securityViolation.model');
const TestAttempt = require('../models/testAttempt.model');
const PracticeTest = require('../models/practiceTest.model');

// Report a security violation (tab switch, window switch, etc.)
exports.reportViolation = async (req, res) => {
  try {
    const { testAttemptId } = req.params;
    const { 
      violationType, 
      additionalInfo 
    } = req.body;

    // Validate violation type
    const validTypes = ['tab_switch', 'window_switch', 'copy_paste', 'right_click', 'developer_tools'];
    if (!validTypes.includes(violationType)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid violation type'
      });
    }

    // Get test attempt details
    const testAttempt = await TestAttempt.findById(testAttemptId);
    if (!testAttempt || testAttempt.status !== 'in_progress') {
      return res.status(404).json({
        status: 'fail',
        message: 'Test attempt not found or not in progress'
      });
    }

    // Verify user owns this attempt
    if (testAttempt.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to access this test attempt'
      });
    }

    // Count existing violations for this user and test attempt
    const existingViolations = await SecurityViolation.find({
      userId: req.user._id,
      testAttemptId,
      violationType: { $in: ['tab_switch', 'window_switch'] }
    });

    const violationCount = existingViolations.length + 1;

    // Create violation record
    const violation = await SecurityViolation.create({
      userId: req.user._id,
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

    // Check if this is the 3rd violation for tab/window switching
    if (['tab_switch', 'window_switch'].includes(violationType) && violationCount >= 3) {
      shouldBlock = true;
      blockedUntil = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours from now
      
      // Update violation to mark as blocked
      violation.isBlocked = true;
      violation.blockedUntil = blockedUntil;
      violation.blockDurationHours = 24;
      await violation.save();

      // Mark test attempt as abandoned due to security violation
      testAttempt.status = 'abandoned';
      testAttempt.completedAt = new Date();
      await testAttempt.save();
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

// Check if user is currently blocked
exports.checkUserBlockStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check for any active blocks
    const blockInfo = await SecurityViolation.getRemainingBlockTime(userId);
    
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

// Get user's violation history
exports.getUserViolationHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const violations = await SecurityViolation.find({ userId })
      .populate('practiceTestId', 'title')
      .populate('testAttemptId', 'startedAt status')
      .sort({ timestamp: -1 })
      .limit(50);

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

// Admin: Get all security violations
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

    const violations = await SecurityViolation.find(filter)
      .populate('userId', 'firstName lastName email')
      .populate('practiceTestId', 'title')
      .populate('testAttemptId', 'startedAt status')
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SecurityViolation.countDocuments(filter);

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

// Admin: Unblock a user
exports.unblockUser = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admins can unblock users'
      });
    }

    const { userId } = req.params;
    
    // Update all active blocks for this user
    await SecurityViolation.updateMany(
      {
        userId,
        isBlocked: true,
        blockedUntil: { $gt: new Date() }
      },
      {
        isBlocked: false,
        blockedUntil: new Date() // Set to current time to expire
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