const { Batch, User, PracticeTest } = require('../models');
const { sequelize } = require('../config/database');

// Create a new batch
exports.createBatch = async (req, res) => {
  try {
    console.log('Create batch request:', {
      user: req.user,
      body: req.body,
      headers: req.headers
    });

    const { batchName, description, maxStudents, tags, startDate, endDate } = req.body;

    // Validate required fields
    if (!batchName) {
      return res.status(400).json({
        status: 'fail',
        message: 'Batch name is required'
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

    const batch = await Batch.findByPk(batchId, {
      include: [
        {
          model: User,
          as: 'admin',
          attributes: ['firstName', 'lastName', 'email']
        },
        {
          model: User,
          as: 'students',
          attributes: ['firstName', 'lastName', 'email', 'studentId', 'isActive']
        }
      ]
    });

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

    const batch = await Batch.findByPk(batchId);
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

    const updatedBatch = await batch.update(updates);

    // Fetch the updated batch with associations
    const populatedBatch = await Batch.findByPk(batchId, {
      include: [
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
      ]
    });

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

    const batch = await Batch.findByPk(batchId);
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

    const batch = await Batch.findByPk(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    // Add students to batch (assuming many-to-many relationship)
    await batch.addStudents(studentIds);

    const updatedBatch = await Batch.findByPk(batchId, {
      include: [
        {
          model: User,
          as: 'students',
          attributes: ['firstName', 'lastName', 'email', 'studentId']
        }
      ]
    });

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

    const batch = await Batch.findByPk(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    // Remove students from batch
    const updatedBatch = await batch.removeStudents(studentIds);

    res.status(200).json({
      status: 'success',
      message: `${studentIds.length} students removed from batch successfully`,
      data: {
        batch: updatedBatch
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

    const batch = await Batch.findByPk(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    // Validate test assignments
    const testIds = testAssignments.map(assignment => assignment.testId);
    const tests = await PracticeTest.findAll({ where: { id: { [sequelize.Op.in]: testIds } } });

    if (tests.length !== testIds.length) {
      return res.status(400).json({
        status: 'fail',
        message: 'Some tests are not valid'
      });
    }

    // Prepare test assignments
    const assignments = testAssignments.map(assignment => ({
      testId: assignment.testId,
      assignedBy: req.user.id,
      dueDate: assignment.dueDate ? new Date(assignment.dueDate) : null,
      instructions: assignment.instructions || '',
      isActive: true
    }));

    // Add assignments to batch
    const updatedBatch = await batch.addAssignedTests(assignments);

    res.status(200).json({
      status: 'success',
      message: `${assignments.length} tests assigned to batch successfully`,
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

    const batch = await Batch.findByPk(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    // Remove tests from batch
    const updatedBatch = await batch.removeAssignedTests(testIds);

    res.status(200).json({
      status: 'success',
      message: `${testIds.length} tests removed from batch successfully`,
      data: {
        batch: updatedBatch
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

    console.log('Fetching batches for student:', studentId);

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
          attributes: ['title', 'description', 'targetUserType', 'duration', 'passingScore', 'questionsPerTest', 'totalQuestions', 'category']
        },
        {
          model: User,
          as: 'assignedTests.assignedBy',
          attributes: ['firstName', 'lastName']
        }
      ],
      where: {
        students: {
          [sequelize.Op.contains]: [studentId]
        },
        status: {
          [sequelize.Op.in]: ['active', 'completed']
        }
      },
      order: [['createdAt', 'DESC']]
    });

    console.log('Found batches:', batches.length);
    console.log('Batch data:', JSON.stringify(batches, null, 2));

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