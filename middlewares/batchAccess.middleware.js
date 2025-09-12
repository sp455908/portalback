const { sequelize } = require('../config/database');

/**
 * Middleware to validate batch access for practice tests
 * Ensures users can only access tests assigned to their batches
 */
const validateBatchAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: 'fail',
        message: 'Authentication required'
      });
    }

    // Skip validation for admin users
    if (req.user.role === 'admin' || req.user.isOwner) {
      return next();
    }

    const { testId } = req.params;
    
    if (!testId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Test ID is required'
      });
    }

    // Get user's active batch assignments
    const userBatchIds = await sequelize.query(`
      SELECT DISTINCT "batchId" 
      FROM "BatchStudents" 
      WHERE "userId" = :userId AND "status" = 'active'
    `, {
      replacements: { userId: req.user.id },
      type: sequelize.QueryTypes.SELECT
    });

    if (userBatchIds.length === 0) {
      // User not in any batches - check if test is public
      const publicTest = await sequelize.query(`
        SELECT id FROM "PracticeTests" 
        WHERE id = :testId 
          AND "isActive" = true 
          AND "showInPublic" = true
          AND "targetUserType" = :userType
      `, {
        replacements: { 
          testId: testId, 
          userType: req.user.userType || req.user.role 
        },
        type: sequelize.QueryTypes.SELECT
      });

      if (publicTest.length === 0) {
        return res.status(403).json({
          status: 'fail',
          message: 'Access denied: You are not enrolled in any batches and this test is not publicly available'
        });
      }
    } else {
      // User in batches - check if test is assigned to their batches
      const batchIds = userBatchIds.map(b => b.batchId);
      
      const batchTestAssignment = await sequelize.query(`
        SELECT COUNT(*) as count
        FROM "BatchAssignedTests" 
        WHERE "batchId" IN (:batchIds) 
          AND "testId" = :testId 
          AND "isActive" = true
      `, {
        replacements: { batchIds: batchIds, testId: testId },
        type: sequelize.QueryTypes.SELECT
      });

      if (batchTestAssignment[0]?.count === 0) {
        return res.status(403).json({
          status: 'fail',
          message: 'Access denied: This test is not assigned to your batch'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Error in validateBatchAccess:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error validating batch access'
    });
  }
};

/**
 * Middleware to validate batch membership for batch operations
 */
const validateBatchMembership = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: 'fail',
        message: 'Authentication required'
      });
    }

    // Skip validation for admin users
    if (req.user.role === 'admin' || req.user.isOwner) {
      return next();
    }

    const { batchId } = req.params;
    
    if (!batchId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Batch ID is required'
      });
    }

    // Check if user is member of this batch
    const batchMembership = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM "BatchStudents" 
      WHERE "userId" = :userId 
        AND "batchId" = :batchId 
        AND "status" = 'active'
    `, {
      replacements: { userId: req.user.id, batchId: batchId },
      type: sequelize.QueryTypes.SELECT
    });

    if (batchMembership[0]?.count === 0) {
      return res.status(403).json({
        status: 'fail',
        message: 'Access denied: You are not a member of this batch'
      });
    }

    next();
  } catch (error) {
    console.error('Error in validateBatchMembership:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error validating batch membership'
    });
  }
};

module.exports = {
  validateBatchAccess,
  validateBatchMembership
};