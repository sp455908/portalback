const mongoose = require('mongoose');
const Batch = require('../models/batch.model');
const User = require('../models/user.model');
const PracticeTest = require('../models/practiceTest.model');

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
    const existingBatch = await Batch.findOne({ batchName });
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
      const count = await mongoose.connection.db.collection('batches').countDocuments({
        batchId: { $regex: `^BATCH-${year}-` }
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
      adminId: req.user._id,
      status: 'active',
      settings: {
        maxStudents: maxStudents || 50,
        allowTestRetakes: req.body.settings?.allowTestRetakes || false,
        requireCompletion: req.body.settings?.requireCompletion !== false, // default true
        autoAssignTests: req.body.settings?.autoAssignTests || false,
        notificationSettings: {
          emailNotifications: req.body.settings?.notificationSettings?.emailNotifications !== false, // default true
          testReminders: req.body.settings?.notificationSettings?.testReminders !== false, // default true
          dueDateAlerts: req.body.settings?.notificationSettings?.dueDateAlerts !== false // default true
        }
      },
      tags: tags || [],
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null
    };

    console.log('Creating batch with data:', batchData);

    const batch = await Batch.create(batchData);

    // Populate the admin info for the response
    const populatedBatch = await Batch.findById(batch._id)
      .populate('adminId', 'firstName lastName email');

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
    const { status, search, page = 1, limit = 10 } = req.query;
    
    let query = {};
    
    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Search functionality
    if (search) {
      query.$or = [
        { batchName: { $regex: search, $options: 'i' } },
        { batchId: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    
    const batches = await Batch.find(query)
      .populate('adminId', 'firstName lastName email')
      .populate('students', 'firstName lastName email studentId isActive')
      .populate('assignedTests.testId', 'title description targetUserType duration passingScore questionsPerTest totalQuestions category')
      .populate('assignedTests.assignedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Batch.countDocuments(query);

    res.status(200).json({
      status: 'success',
      data: {
        batches,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    console.error('Error in getAllBatches:', err);
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

    const batch = await Batch.findById(batchId)
      .populate('adminId', 'firstName lastName email')
      .populate('students', 'firstName lastName email studentId isActive')
      .populate('assignedTests.testId', 'title description targetUserType duration passingScore')
      .populate('assignedTests.assignedBy', 'firstName lastName');

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

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    // Check if batch name is being updated and if it already exists
    if (updates.batchName && updates.batchName !== batch.batchName) {
      const existingBatch = await Batch.findOne({ 
        batchName: updates.batchName,
        _id: { $ne: batchId }
      });
      if (existingBatch) {
        return res.status(400).json({
          status: 'fail',
          message: 'Batch name already exists'
        });
      }
    }

    const updatedBatch = await Batch.findByIdAndUpdate(
      batchId,
      updates,
      { new: true, runValidators: true }
    ).populate('adminId', 'firstName lastName email')
     .populate('students', 'firstName lastName email studentId')
     .populate('assignedTests.testId', 'title category');

    res.status(200).json({
      status: 'success',
      message: 'Batch updated successfully',
      data: {
        batch: updatedBatch
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

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    await Batch.findByIdAndDelete(batchId);

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

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    // Check if students exist and are actually students
    const students = await User.find({
      _id: { $in: studentIds },
      role: 'student'
    });

    if (students.length !== studentIds.length) {
      return res.status(400).json({
        status: 'fail',
        message: 'Some users are not valid students'
      });
    }

    // Check if adding these students would exceed max limit
    const currentCount = batch.students.length;
    const newCount = currentCount + studentIds.length;
    
    if (newCount > batch.settings.maxStudents) {
      return res.status(400).json({
        status: 'fail',
        message: `Cannot add students. Batch limit is ${batch.settings.maxStudents}. Current: ${currentCount}, Adding: ${studentIds.length}`
      });
    }

    // Add students to batch
    const updatedBatch = await Batch.findByIdAndUpdate(
      batchId,
      { $addToSet: { students: { $each: studentIds } } },
      { new: true }
    ).populate('students', 'firstName lastName email studentId');

    res.status(200).json({
      status: 'success',
      message: `${studentIds.length} students added to batch successfully`,
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

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    // Remove students from batch
    const updatedBatch = await Batch.findByIdAndUpdate(
      batchId,
      { $pull: { students: { $in: studentIds } } },
      { new: true }
    ).populate('students', 'firstName lastName email studentId');

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

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    // Validate test assignments
    const testIds = testAssignments.map(assignment => assignment.testId);
    const tests = await PracticeTest.find({ _id: { $in: testIds } });

    if (tests.length !== testIds.length) {
      return res.status(400).json({
        status: 'fail',
        message: 'Some tests are not valid'
      });
    }

    // Prepare test assignments
    const assignments = testAssignments.map(assignment => ({
      testId: assignment.testId,
      assignedBy: req.user._id,
      dueDate: assignment.dueDate ? new Date(assignment.dueDate) : null,
      instructions: assignment.instructions || '',
      isActive: true
    }));

    // Add assignments to batch
    const updatedBatch = await Batch.findByIdAndUpdate(
      batchId,
      { $push: { assignedTests: { $each: assignments } } },
      { new: true }
    ).populate('assignedTests.testId', 'title description targetUserType duration passingScore questionsPerTest totalQuestions category')
     .populate('assignedTests.assignedBy', 'firstName lastName');

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

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    // Remove tests from batch
    const updatedBatch = await Batch.findByIdAndUpdate(
      batchId,
      { $pull: { assignedTests: { testId: { $in: testIds } } } },
      { new: true }
    ).populate('assignedTests.testId', 'title description targetUserType duration passingScore questionsPerTest totalQuestions category');

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

    const batch = await Batch.findById(batchId)
      .populate('students', 'firstName lastName email studentId')
      .populate('assignedTests.testId', 'title category');

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
      completionRate: batch.settings.requireCompletion ? 'Required' : 'Optional',
      maxStudents: batch.settings.maxStudents,
      availableSlots: batch.settings.maxStudents - batch.students.length
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

    const batches = await Batch.find({
      students: studentId,
      status: { $in: ['active', 'completed'] }
    })
    .populate('adminId', 'firstName lastName email')
    .populate('assignedTests.testId', 'title description targetUserType duration passingScore questionsPerTest totalQuestions category')
    .populate('assignedTests.assignedBy', 'firstName lastName')
    .sort({ createdAt: -1 });

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

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        status: 'fail',
        message: 'Batch not found'
      });
    }

    // Update settings
    const updatedBatch = await Batch.findByIdAndUpdate(
      batchId,
      { $set: { settings } },
      { new: true, runValidators: true }
    );

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