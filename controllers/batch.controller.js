const { Batch, User, PracticeTest, BatchStudent } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

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


exports.createBatch = async (req, res) => {
  try {
    console.log('Create batch request:', {
      user: req.user,
      body: req.body,
      headers: req.headers
    });

    const { batchName, description, maxStudents, tags, startDate, endDate, userType } = req.body;

    
    if (!batchName) {
      return res.status(400).json({
        status: 'fail',
        message: 'Batch name is required'
      });
    }

    
    if (userType && !['student', 'corporate', 'government'].includes(userType)) {
      return res.status(400).json({
        status: 'fail',
        message: 'User type must be student, corporate, or government'
      });
    }

    
    const existingBatch = await Batch.findOne({ where: { batchName } });
    if (existingBatch) {
      return res.status(400).json({
        status: 'fail',
        message: 'Batch name already exists'
      });
    }

    
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
      requireCompletion: req.body.settings?.requireCompletion !== false, 
      autoAssignTests: req.body.settings?.autoAssignTests || false,
      emailNotifications: req.body.settings?.notificationSettings?.emailNotifications !== false, 
      testReminders: req.body.settings?.notificationSettings?.testReminders !== false, 
      dueDateAlerts: req.body.settings?.notificationSettings?.dueDateAlerts !== false, 
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null
    };

    
    if (userType) {
      batchData.userType = userType;
    }

    console.log('Creating batch with data:', batchData);

    const batch = await Batch.create(batchData);

    
    const populatedBatch = await Batch.findByPk(batch.id, {
      include: [{
        model: User,
        as: 'admin',
        attributes: ['firstName', 'lastName', 'email']
      }]
    });

    
    const responseBatch = {
      ...populatedBatch.toJSON(),
      userType: populatedBatch.userType || userType || 'student'
    };

    res.status(201).json({
      status: 'success',
      message: 'Batch created successfully',
      data: {
        batch: responseBatch
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


exports.getAllBatches = async (req, res) => {
  try {
    console.log('Getting all batches with query:', req.query);
    
    const { status, search, page = 1, limit = 10 } = req.query;
    
    let whereClause = {};
    
    
    if (status && status !== 'all') {
      whereClause.status = status;
    }
    
    
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
    
    
    let batches, count;
    try {
      const result = await Batch.findAndCountAll({
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
            attributes: ['id', 'title', 'description', 'targetUserType', 'duration', 'passingScore', 'questionsPerTest', 'totalQuestions', 'category'],
            through: { attributes: ['dueDate', 'instructions', 'assignedAt', 'assignedBy', 'isActive'] }
          }
        ],
        order: [['createdAt', 'DESC']],
        offset: parseInt(offset),
        limit: parseInt(limit)
      });
      
      batches = result.rows;
      count = result.count;
      
      
      batches = batches.map(batch => ({
        ...batch.toJSON(),
        userType: batch.userType || 'student'
      }));
      
    } catch (error) {
      if (error.message.includes('userType') || error.message.includes('column') || error.message.includes('does not exist')) {
        console.log('userType column not found, using fallback query...');
        
        
        const result = await Batch.findAndCountAll({
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
              attributes: ['id', 'title', 'description', 'targetUserType', 'duration', 'passingScore', 'questionsPerTest', 'totalQuestions', 'category'],
              through: { attributes: ['dueDate', 'instructions', 'assignedAt', 'assignedBy', 'isActive'] }
            }
          ],
          order: [['createdAt', 'DESC']],
          offset: parseInt(offset),
          limit: parseInt(limit)
        });
        
        batches = result.rows;
        count = result.count;
        
        
        batches = batches.map(batch => ({
          ...batch.toJSON(),
          userType: 'student'
        }));
      } else {
        throw error;
      }
    }

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


exports.updateBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const updates = req.body;

    console.log('Update batch request:', { batchId, updates });

    const batch = await findBatchByParam(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    
    if (updates.batchName && updates.batchName !== batch.batchName) {
      const existingBatch = await Batch.findOne({ 
        where: {
          batchName: updates.batchName,
          id: { [sequelize.Op.ne]: batch.id }
        }
      });
      if (existingBatch) {
        return res.status(400).json({
          status: 'fail',
          message: 'Batch name already exists'
        });
      }
    }

    
    if (updates.userType && !['student', 'corporate', 'government'].includes(updates.userType)) {
      return res.status(400).json({
        status: 'fail',
        message: 'User type must be student, corporate, or government'
      });
    }

    
    let settingsUpdates = {};
    if (updates.settings) {
      settingsUpdates = {
        maxStudents: updates.settings.maxStudents,
        allowTestRetakes: updates.settings.allowTestRetakes,
        requireCompletion: updates.settings.requireCompletion,
        autoAssignTests: updates.settings.autoAssignTests,
        emailNotifications: updates.settings.notificationSettings?.emailNotifications,
        testReminders: updates.settings.notificationSettings?.testReminders,
        dueDateAlerts: updates.settings.notificationSettings?.dueDateAlerts
      };
    }

    
    const { settings, ...mainUpdates } = updates;
    
    
    const allUpdates = { ...mainUpdates, ...settingsUpdates };
    
    console.log('Applying updates:', allUpdates);

    const updatedBatch = await batch.update(allUpdates);

    
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

    console.log('Batch updated successfully');

    res.status(200).json({
      status: 'success',
      message: 'Batch updated successfully',
      data: {
        batch: populatedBatch
      }
    });
  } catch (err) {
    console.error('Error in updateBatch:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update batch',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


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

    
    const numericUserIds = studentIds
      .map(id => Number(id))
      .filter(n => !isNaN(n));

    if (!numericUserIds.length) {
      return res.status(400).json({ status: 'fail', message: 'Invalid student IDs' });
    }

    
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


exports.checkStudentsConflicts = async (req, res) => {
  try {
    const { batchId } = req.params;
    if (!batchId) {
      return res.status(400).json({ status: 'fail', message: 'Invalid batchId' });
    }

    
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

    
    const currentBatch = await findBatchByParam(batchId);
    if (!currentBatch) {
      return res.status(404).json({ status: 'fail', message: 'Batch not found' });
    }

    
    const conflicts = await BatchStudent.findAll({
      where: {
        userId: userIds,
        status: 'active',
        batchId: { [Op.ne]: currentBatch.id } 
      },
      include: [
        {
          model: Batch,
          as: 'batch',
          attributes: ['id', 'batchId', 'batchName', 'status', 'userType'],
          required: true
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'studentId'],
          required: true
        }
      ]
    });

    
    const conflictingStudents = conflicts.map(conflict => ({
      studentId: String(conflict.userId),
      studentName: `${conflict.user.firstName} ${conflict.user.lastName}`,
      studentEmail: conflict.user.email,
      studentStudentId: conflict.user.studentId,
      batchId: conflict.Batch.batchId,
      batchName: conflict.Batch.batchName,
      batchStatus: conflict.Batch.status,
      batchUserType: conflict.Batch.userType
    }));

    return res.status(200).json({
      status: 'success',
      data: {
        conflicts: conflicts.map(c => ({ userId: c.userId, batchId: c.batchId })),
        conflictingStudents: conflictingStudents
      }
    });
  } catch (err) {
    console.error('Error in checkStudentsConflicts:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to check student conflicts',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


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

    
    const batch = await findBatchByParam(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    
    const numericUserIds = studentIds
      .map(id => Number(id))
      .filter(n => !isNaN(n));

    if (!numericUserIds.length) {
      return res.status(400).json({ status: 'fail', message: 'Invalid student IDs' });
    }

    
    await batch.removeStudents(numericUserIds);

    
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


exports.assignTestsToBatch = async (req, res) => {
  try {
    console.log('assignTestsToBatch called with:', { batchId: req.params.batchId, testAssignments: req.body.testAssignments });
    const { batchId } = req.params;
    const { testAssignments } = req.body;

    if (!testAssignments || !Array.isArray(testAssignments) || testAssignments.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Test assignments array is required'
      });
    }

  const batch = await findBatchByParam(batchId);
    console.log('Found batch:', batch ? { id: batch.id, batchId: batch.batchId, userType: batch.userType } : null);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    
    const testIds = testAssignments.map(assignment => Number(assignment.testId)).filter(n => !isNaN(n));
    if (!testIds.length) {
      return res.status(400).json({ status: 'fail', message: 'Invalid test IDs' });
    }
    
    
    const batchDetails = await findBatchByParam(batchId);
    console.log('Batch details:', batchDetails ? { id: batchDetails.id, batchId: batchDetails.batchId, userType: batchDetails.userType } : null);
    if (!batchDetails) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }
    
    const tests = await PracticeTest.findAll({ where: { id: { [Op.in]: testIds } } });
    console.log('Found tests:', tests.map(t => ({ id: t.id, title: t.title, targetUserType: t.targetUserType })));

    if (tests.length !== testIds.length) {
      return res.status(400).json({
        status: 'fail',
        message: 'Some tests are not valid'
      });
    }
    
    
    console.log('Validating userType match - batch userType:', batchDetails.userType);
    const mismatchedTests = tests.filter(test => test.targetUserType !== batchDetails.userType);
    console.log('Mismatched tests:', mismatchedTests.map(t => ({ title: t.title, targetUserType: t.targetUserType })));
    if (mismatchedTests.length > 0) {
      const testNames = mismatchedTests.map(t => t.title).join(', ');
      return res.status(400).json({
        status: 'fail',
        message: `Cannot assign tests with different user types. The following tests are for ${mismatchedTests[0].targetUserType} users but this batch is for ${batchDetails.userType} users: ${testNames}`
      });
    }

    
    console.log('Starting test assignments...');
    await Promise.all(testAssignments.map(async assignment => {
      const testId = Number(assignment.testId);
      if (isNaN(testId)) return;
      console.log('Assigning test:', testId, 'to batch:', batch.id);
      await batch.addAssignedTest(testId, {
        through: {
          assignedBy: req.user.id,
          dueDate: assignment.dueDate ? new Date(assignment.dueDate) : null,
          instructions: assignment.instructions || '',
          isActive: true
        }
      });
    }));
    console.log('Test assignments completed');

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
    console.error('Error in assignTestsToBatch:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({
      status: 'error',
      message: 'Failed to assign tests to batch',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


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


exports.getStudentBatches = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    let numericStudentId = null;
    if (req.user && req.user.id) {
      numericStudentId = Number(req.user.id);
    } else if (studentId) {
      numericStudentId = Number(studentId);
    }

    if (isNaN(Number(numericStudentId))) {
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

    
    const batchIds = batches.map(b => b.id);
    let countsByBatchId = {};
    if (batchIds.length > 0) {
      try {
        const counts = await BatchStudent.findAll({
          where: { batchId: batchIds, status: 'active' },
          attributes: ['batchId', [sequelize.fn('COUNT', sequelize.col('userId')), 'count']],
          group: ['batchId']
        });
        countsByBatchId = counts.reduce((acc, row) => {
          const r = row.toJSON();
          acc[String(r.batchId)] = Number(r.count) || 0;
          return acc;
        }, {});
      } catch (countErr) {
        console.error('Failed to compute students count:', countErr);
      }
    }

    
    const enrichedBatches = batches.map(b => {
      const json = b.toJSON();
      return {
        ...json,
        userType: json.userType || 'student',
        studentsCount: countsByBatchId[String(json.id)] || 0
      };
    });

    res.status(200).json({
      status: 'success',
      data: {
        batches: enrichedBatches
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


exports.updateBatchSettings = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { settings } = req.body;

    const batch = await findBatchByParam(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    
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


exports.getDashboardStats = async (req, res) => {
  try {
    console.log('Getting batch statistics for dashboard');
    
    let totalStudents = 0;
    let totalAssignedTestsCount = 0;
    
    try {
      
      totalStudents = await BatchStudent.count({
        where: { status: 'active' }
      });
      console.log('Total active students:', totalStudents);
    } catch (studentError) {
      console.error('Error counting students:', studentError);
      
      totalStudents = 0;
    }
    
    try {
      const totalAssignedTests = await sequelize.query(`
        SELECT COUNT(*) as count 
        FROM "BatchAssignedTests" 
        WHERE "isActive" = true
      `, { type: sequelize.QueryTypes.SELECT });
      
      totalAssignedTestsCount = totalAssignedTests[0]?.count || 0;
      console.log('Total assigned tests:', totalAssignedTestsCount);
    } catch (testError) {
      console.error('Error counting assigned tests:', testError);
      
      totalAssignedTestsCount = 0;
    }
    
    console.log('Batch statistics:', { totalStudents, totalAssignedTests: totalAssignedTestsCount });
    
    res.status(200).json({
      status: 'success',
      data: {
        totalStudents,
        totalAssignedTests: totalAssignedTestsCount
      }
    });
  } catch (err) {
    console.error('Error in getDashboardStats:', err);
    console.error('Error stack:', err.stack);
    
    
    res.status(200).json({
      status: 'success',
      data: {
        totalStudents: 0,
        totalAssignedTests: 0
      }
    });
  }
};


exports.getAllStudentConflicts = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { userType } = req.query;

    
    if (!batchId || batchId === 'undefined' || batchId === 'null') {
      return res.status(400).json({ status: 'fail', message: 'Invalid batchId' });
    }

    
    if (userType && !['student', 'corporate', 'government'].includes(userType)) {
      return res.status(400).json({ 
        status: 'fail', 
        message: 'Invalid userType. Must be student, corporate, or government' 
      });
    }

    
    const currentBatch = await findBatchByParam(batchId);
    if (!currentBatch) {
      return res.status(404).json({ status: 'fail', message: 'Batch not found' });
    }

    
    if (req.user && (req.user.role === 'admin' || req.user.isOwner)) {
      
    } else if (req.user && req.user.role !== 'admin' && !req.user.isOwner) {
      return res.status(403).json({ 
        status: 'fail', 
        message: 'Access denied. Admin privileges required.' 
      });
    }

    
    let whereClause = { isActive: true };
    if (userType && ['student', 'corporate', 'government'].includes(userType)) {
      whereClause.userType = userType;
    }

    
    const maxUsers = 1000;
    const users = await User.findAll({
      where: whereClause,
      attributes: ['id', 'firstName', 'lastName', 'email', 'studentId', 'userType'],
      limit: maxUsers,
      order: [['createdAt', 'DESC']]
    });

    if (users.length === 0) {
      return res.status(200).json({
        status: 'success',
        data: {
          conflicts: [],
          conflictingStudents: [],
          userConflictsMap: {}
        }
      });
    }

    
    console.log(`Conflict check requested for batch ${batchId}, userType: ${userType}, users: ${users.length}`);

    const userIds = users.map(u => u.id);

    
    const conflicts = await BatchStudent.findAll({
      where: {
        userId: userIds,
        status: 'active',
        batchId: { [Op.ne]: currentBatch.id } 
      },
      include: [
        {
          model: Batch,
          as: 'Batch',
          attributes: ['id', 'batchId', 'batchName', 'status', 'userType'],
          required: true
        }
      ]
    });

    
    const conflictingStudents = conflicts.map(conflict => {
      const user = users.find(u => u.id === conflict.userId);
      return {
        studentId: String(conflict.userId),
        studentName: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
        studentEmail: user ? user.email : '',
        studentStudentId: user ? user.studentId : '',
        batchId: conflict.Batch.batchId,
        batchName: conflict.Batch.batchName,
        batchStatus: conflict.Batch.status,
        batchUserType: conflict.Batch.userType
      };
    });

    
    const userConflictsMap = {};
    conflictingStudents.forEach(conflict => {
      
      const user = users.find(u => u.id === Number(conflict.studentId));
      if (user) {
        const userKey = String(user.id); 
        if (!userConflictsMap[userKey]) {
          userConflictsMap[userKey] = [];
        }
        userConflictsMap[userKey].push(conflict);
      }
    });

    return res.status(200).json({
      status: 'success',
      data: {
        conflicts: conflicts.map(c => ({ userId: c.userId, batchId: c.batchId })),
        conflictingStudents: conflictingStudents,
        userConflictsMap: userConflictsMap
      }
    });
  } catch (err) {
    console.error('Error in getAllStudentConflicts:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get student conflicts',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


exports.batchHealthCheck = async (req, res) => {
  try {
    const batchCount = await Batch.count();
    
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
    res.status(500).json({
      status: 'error',
      message: 'Batch model health check failed'
    });
  }
}; 