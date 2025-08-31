const { Batch, User, PracticeTest, BatchStudent } = require('../models');
const { Op } = require('sequelize');
// Helper: resolve batch by numeric primary key or by string batchId code
const findBatchByParam = async (batchIdParam, include = undefined) => {
  if (!batchIdParam) return null;
  if (batchIdParam === 'undefined' || batchIdParam === 'null') return null;
  const param = String(batchIdParam).trim();
  const isNumeric = /^\d+$/.test(param);
  const orConditions = [{ batchId: { [Op.eq]: param } }];
  if (isNumeric) {
    orConditions.push({ id: Number(param) });
  }
  return await Batch.findOne({ where: { [Op.or]: orConditions }, include });
};
const { sequelize } = require('../config/database');

// Create a new batch
exports.createBatch = async (req, res) => {
  try {
    console.log('Create batch request:', {
      user: req.user,
      body: req.body,
      headers: req.headers
    });

    const { batchName, description, maxStudents, tags, startDate, endDate, userType } = req.body;

    // Validate required fields
    if (!batchName) {
      return res.status(400).json({
        status: 'fail',
        message: 'Batch name is required'
      });
    }

    if (!userType || !['student', 'corporate', 'government'].includes(userType)) {
      return res.status(400).json({
        status: 'fail',
        message: 'User type is required and must be student, corporate, or government'
      });
    }

    // Check if batch name already exists
    const existingBatch = await Batch.findOne({ where: { batchName } });
    if (existingBatch) {
      return res.status(400).json({
        status: 'fail',
        message: 'Batch name already exists'
      });
    }

    // Generate batch ID manually to ensure it's created
    const year = new Date().getFullYear();
    let batchId;
    try {
      const count = await Batch.count({
        where: {
          batchId: {
            [sequelize.Op.like]: `BATCH-${year}-%`
          }
        }
      });
      batchId = `BATCH-${year}-${String(count + 1).padStart(4, '0')}`;
    } catch (error) {
      // Fallback to timestamp if counting fails
      batchId = `BATCH-${year}-${Date.now()}`;
    }

    const batchData = {
      batchId,
      batchName,
      description,
      userType,
      adminId: req.user.id,
      status: 'active',
      maxStudents: maxStudents || 50,
      allowTestRetakes: req.body.settings?.allowTestRetakes || false,
      requireCompletion: req.body.settings?.requireCompletion !== false, // default true
      autoAssignTests: req.body.settings?.autoAssignTests || false,
      emailNotifications: req.body.settings?.notificationSettings?.emailNotifications !== false, // default true
      testReminders: req.body.settings?.notificationSettings?.testReminders !== false, // default true
      dueDateAlerts: req.body.settings?.notificationSettings?.dueDateAlerts !== false, // default true
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null
    };

    console.log('Creating batch with data:', batchData);

    const batch = await Batch.create(batchData);

    // Populate the admin info for the response
    const populatedBatch = await Batch.findByPk(batch.id, {
      include: [{
        model: User,
        as: 'admin',
        attributes: ['firstName', 'lastName', 'email']
      }]
    });

    res.status(201).json({
      status: 'success',
      message: 'Batch created successfully',
      data: {
        batch: populatedBatch
      }
    });
  } catch (err) {
    console.error('Error in createBatch:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create batch',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get all batches (admin only)
exports.getAllBatches = async (req, res) => {
  try {
    console.log('Getting all batches with query:', req.query);
    
    const { status, search, page = 1, limit = 10 } = req.query;
    
    let whereClause = {};
    
    // Filter by status
    if (status && status !== 'all') {
      whereClause.status = status;
    }
    
    // Search functionality
    if (search) {
      whereClause[sequelize.Op.or] = [
        { batchName: { [sequelize.Op.iLike]: `%${search}%` } },
        { batchId: { [sequelize.Op.iLike]: `%${search}%` } },
        { description: { [sequelize.Op.iLike]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;
    
    console.log('Batch query where clause:', whereClause);
    console.log('Pagination:', { offset, limit });
    
    const { count, rows: batches } = await Batch.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'admin',
          attributes: ['firstName', 'lastName', 'email']
        },
        {
          model: User,
          as: 'students',
          attributes: ['id'],
          through: { attributes: [] }
        },
        {
          model: PracticeTest,
          as: 'assignedTests',
          attributes: ['id'],
          through: { attributes: [] }
        }
      ],
      order: [['createdAt', 'DESC']],
      offset: parseInt(offset),
      limit: parseInt(limit)
    });

    console.log('Batch query result:', { count, batchesCount: batches.length });

    res.status(200).json({
      status: 'success',
      data: {
        batches: batches || [],
        pagination: {
          total: count || 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (err) {
    console.error('Error in getAllBatches:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch batches',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get single batch by ID
exports.getBatchById = async (req, res) => {
  try {
    const { batchId } = req.params;

    const batch = await findBatchByParam(batchId, [
      {
        model: User,
        as: 'admin',
        attributes: ['id', 'firstName', 'lastName', 'email']
      },
      {
        model: User,
        as: 'students',
        attributes: ['id', 'firstName', 'lastName', 'email', 'studentId', 'isActive'],
        through: { attributes: [] }
      },
      {
        model: PracticeTest,
        as: 'assignedTests',
        attributes: ['id', 'title', 'description', 'isActive', 'totalQuestions'],
        through: { attributes: ['dueDate', 'instructions', 'assignedAt', 'assignedBy', 'isActive'] }
      }
    ]);

    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        batch
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch batch',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Update batch
exports.updateBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const updates = req.body;

    const batch = await findBatchByParam(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    // Check if batch name is being updated and if it already exists
    if (updates.batchName && updates.batchName !== batch.batchName) {
      const existingBatch = await Batch.findOne({ 
        where: {
          batchName: updates.batchName,
          id: { [sequelize.Op.ne]: batchId }
        }
      });
      if (existingBatch) {
        return res.status(400).json({
          status: 'fail',
          message: 'Batch name already exists'
        });
      }
    }

    // Validate userType if being updated
    if (updates.userType && !['student', 'corporate', 'government'].includes(updates.userType)) {
      return res.status(400).json({
        status: 'fail',
        message: 'User type must be student, corporate, or government'
      });
    }

    const updatedBatch = await batch.update(updates);

    // Fetch the updated batch with associations
    const populatedBatch = await findBatchByParam(batchId, [
      {
        model: User,
        as: 'admin',
        attributes: ['firstName', 'lastName', 'email']
      },
      {
        model: User,
        as: 'students',
        attributes: ['firstName', 'lastName', 'email', 'studentId']
      }
    ]);

    res.status(200).json({
      status: 'success',
      message: 'Batch updated successfully',
      data: {
        batch: populatedBatch
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update batch',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Delete batch
exports.deleteBatch = async (req, res) => {
  try {
    const { batchId } = req.params;

    const batch = await findBatchByParam(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    await batch.destroy();

    res.status(200).json({
      status: 'success',
      message: 'Batch deleted successfully'
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete batch',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Add students to batch
exports.addStudentsToBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { studentIds } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Student IDs array is required'
      });
    }

    const batch = await findBatchByParam(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    // Coerce to numeric user IDs (Sequelize FK uses integers)
    const numericUserIds = studentIds
      .map(id => Number(id))
      .filter(n => !isNaN(n));

    if (!numericUserIds.length) {
      return res.status(400).json({ status: 'fail', message: 'Invalid student IDs' });
    }

    // Add students to batch (many-to-many)
    await batch.addStudents(numericUserIds);

    const updatedBatch = await findBatchByParam(batchId, [
      {
        model: User,
        as: 'students',
        attributes: ['firstName', 'lastName', 'email', 'studentId']
      }
    ]);

    res.status(200).json({
      status: 'success',
      message: 'Students added to batch successfully',
      data: {
        batch: updatedBatch
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to add students to batch',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Check if given students are already in other active batches
exports.checkStudentsConflicts = async (req, res) => {
  try {
    const { batchId } = req.params;
    if (!batchId) {
      return res.status(400).json({ status: 'fail', message: 'Invalid batchId' });
    }

    // Accept userIds via query (?userIds=1,2,3) or JSON body { userIds: [] }
    let userIds = [];
    if (req.query.userIds) {
      userIds = String(req.query.userIds)
        .split(',')
        .map(id => Number(id))
        .filter(n => !isNaN(n));
    } else if (Array.isArray(req.body?.userIds)) {
      userIds = req.body.userIds.map(n => Number(n)).filter(n => !isNaN(n));
    }

    if (!userIds.length) {
      return res.status(400).json({ status: 'fail', message: 'userIds are required' });
    }

    const conflicts = await BatchStudent.findAll({
      where: {
        userId: userIds,
        status: 'active'
      },
      attributes: ['userId', 'batchId']
    });

    // Exclude the current batch regardless of whether frontend sent PK or code
    const currentBatch = await findBatchByParam(batchId);
    const currentBatchPk = currentBatch ? currentBatch.id : null;
    const filtered = currentBatchPk
      ? conflicts.filter(c => Number(c.batchId) !== Number(currentBatchPk))
      : conflicts;

    return res.status(200).json({
      status: 'success',
      data: {
        conflicts: filtered
      }
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to check student conflicts',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Remove students from batch
exports.removeStudentsFromBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { studentIds } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Student IDs array is required'
      });
    }

    // Resolve batch by PK or human-readable code
    const batch = await findBatchByParam(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    // Coerce to numeric user IDs for FK
    const numericUserIds = studentIds
      .map(id => Number(id))
      .filter(n => !isNaN(n));

    if (!numericUserIds.length) {
      return res.status(400).json({ status: 'fail', message: 'Invalid student IDs' });
    }

    // Remove students from batch
    await batch.removeStudents(numericUserIds);

    // Return refreshed batch with students
    const refreshed = await findBatchByParam(batchId, [
      {
        model: User,
        as: 'students',
        attributes: ['id', 'firstName', 'lastName', 'email', 'studentId', 'isActive'],
        through: { attributes: [] }
      }
    ]);

    res.status(200).json({
      status: 'success',
      message: `${numericUserIds.length} students removed from batch successfully`,
      data: {
        batch: refreshed
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to remove students from batch',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Assign tests to batch
exports.assignTestsToBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { testAssignments } = req.body;

    if (!testAssignments || !Array.isArray(testAssignments) || testAssignments.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Test assignments array is required'
      });
    }

  const batch = await findBatchByParam(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    // Validate test assignments
    // Validate test assignments
    const testIds = testAssignments.map(assignment => Number(assignment.testId)).filter(n => !isNaN(n));
    if (!testIds.length) {
      return res.status(400).json({ status: 'fail', message: 'Invalid test IDs' });
    }
    const tests = await PracticeTest.findAll({ where: { id: { [Op.in]: testIds } } });

    if (tests.length !== testIds.length) {
      return res.status(400).json({
        status: 'fail',
        message: 'Some tests are not valid'
      });
    }

    // Add assignments to batch with through attributes
    await Promise.all(testAssignments.map(async assignment => {
      const testId = Number(assignment.testId);
      if (isNaN(testId)) return;
      await batch.addAssignedTest(testId, {
        through: {
          assignedBy: req.user.id,
          dueDate: assignment.dueDate ? new Date(assignment.dueDate) : null,
          instructions: assignment.instructions || '',
          isActive: true
        }
      });
    }));

    const updatedBatch = await findBatchByParam(batchId, [
      {
        model: PracticeTest,
        as: 'assignedTests',
        attributes: ['id', 'title', 'description', 'isActive', 'totalQuestions'],
        through: { attributes: ['dueDate', 'instructions', 'assignedAt', 'assignedBy', 'isActive'] }
      }
    ]);

    res.status(200).json({
      status: 'success',
      message: `${testAssignments.length} tests assigned to batch successfully`,
      data: {
        batch: updatedBatch
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to assign tests to batch',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Remove tests from batch
exports.removeTestsFromBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { testIds } = req.body;

    if (!testIds || !Array.isArray(testIds) || testIds.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Test IDs array is required'
      });
    }

    const batch = await findBatchByParam(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    const numericTestIds = testIds.map(id => Number(id)).filter(n => !isNaN(n));
    if (!numericTestIds.length) {
      return res.status(400).json({ status: 'fail', message: 'Invalid test IDs' });
    }

    await batch.removeAssignedTests(numericTestIds);

    const refreshed = await findBatchByParam(batchId, [
      {
        model: PracticeTest,
        as: 'assignedTests',
        attributes: ['id', 'title', 'description', 'isActive', 'totalQuestions'],
        through: { attributes: ['dueDate', 'instructions', 'assignedAt', 'assignedBy', 'isActive'] }
      }
    ]);

    res.status(200).json({
      status: 'success',
      message: `${numericTestIds.length} tests removed from batch successfully`,
      data: {
        batch: refreshed
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to remove tests from batch',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get batch statistics
exports.getBatchStats = async (req, res) => {
  try {
    const { batchId } = req.params;

    const batch = await Batch.findByPk(batchId, {
      include: [
        {
          model: User,
          as: 'students',
          attributes: ['firstName', 'lastName', 'email', 'studentId']
        },
        {
          model: PracticeTest,
          as: 'assignedTests',
          attributes: ['title', 'category']
        }
      ]
    });

    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    // Calculate statistics
    const stats = {
      totalStudents: batch.students.length,
      activeStudents: batch.students.filter(student => student.isActive).length,
      totalTests: batch.assignedTests.length,
      activeTests: batch.assignedTests.filter(test => test.isActive).length,
      completionRate: batch.requireCompletion ? 'Required' : 'Optional',
      maxStudents: batch.maxStudents,
      availableSlots: batch.maxStudents - batch.students.length
    };

    res.status(200).json({
      status: 'success',
      data: {
        batch,
        stats
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch batch statistics',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get batches for a specific student
exports.getStudentBatches = async (req, res) => {
  try {
    const { studentId } = req.params;
    const numericStudentId = Number(studentId);
    if (isNaN(numericStudentId)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid studentId' });
    }

    console.log('Fetching batches for student (by join table):', numericStudentId);

    const batches = await Batch.findAll({
      include: [
        {
          model: User,
          as: 'admin',
          attributes: ['firstName', 'lastName', 'email']
        },
        {
          model: PracticeTest,
          as: 'assignedTests',
          attributes: ['id', 'title', 'description', 'targetUserType', 'duration', 'passingScore', 'questionsPerTest', 'totalQuestions', 'category'],
          through: { attributes: ['dueDate', 'instructions', 'assignedAt', 'assignedBy', 'isActive'] }
        },
        {
          model: User,
          as: 'students',
          attributes: [],
          through: { attributes: [] },
          where: { id: numericStudentId }
        }
      ],
      where: {
        status: { [Op.in]: ['active', 'completed'] }
      },
      order: [['createdAt', 'DESC']]
    });

    console.log('Found batches for student:', batches.length);

    res.status(200).json({
      status: 'success',
      data: {
        batches
      }
    });
  } catch (err) {
    console.error('Error in getStudentBatches:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch student batches',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Update batch settings
exports.updateBatchSettings = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { settings } = req.body;

    const batch = await Batch.findByPk(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    // Update settings
    const updatedBatch = await batch.update({ settings });

    res.status(200).json({
      status: 'success',
      message: 'Batch settings updated successfully',
      data: {
        batch: updatedBatch
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update batch settings',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}; 

// Get batch statistics for dashboard
exports.getBatchStats = async (req, res) => {
  try {
    console.log('Getting batch statistics for dashboard');
    console.log('Request URL:', req.url);
    console.log('Request method:', req.method);
    console.log('Request params:', req.params);
    
    // For now, return default values to get the endpoint working
    // We can enhance this later with actual database queries
    const totalStudents = 0;
    const totalAssignedTests = 0;
    
    console.log('Batch statistics (default):', { totalStudents, totalAssignedTests });
    
    res.status(200).json({
      status: 'success',
      data: {
        totalStudents,
        totalAssignedTests
      }
    });
  } catch (err) {
    console.error('Error in getBatchStats:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch batch statistics',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Health check for batches
exports.batchHealthCheck = async (req, res) => {
  try {
    console.log('Batch health check requested');
    
    // Simple query to test if Batch model is working
    const batchCount = await Batch.count();
    
    console.log('Batch count:', batchCount);
    
    res.status(200).json({
      status: 'success',
      message: 'Batch model is working',
      data: {
        batchCount,
        model: 'Batch',
        database: 'PostgreSQL',
        associations: ['admin', 'students', 'assignedTests']
      }
    });
  } catch (err) {
    console.error('Error in batch health check:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({
      status: 'error',
      message: 'Batch model health check failed',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}; 