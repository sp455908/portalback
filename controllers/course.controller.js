const { Course, User, sequelize } = require('../models');

// Create a new course (admin only)
exports.createCourse = async (req, res) => {
  try {
    const { title, description, duration, modules, fee, isActive, targetUserType } = req.body;
    
    // Basic validation
    if (!title || !description || !duration || !modules || !fee) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const course = await Course.create({
      title,
      description,
      duration,
      modules,
      fee,
      isActive: isActive || false, // Default to false if not provided
      targetUserType: targetUserType || 'student' // Default to student if not provided
    });

    res.status(201).json({
      id: course.id,
      title: course.title,
      description: course.description,
      duration: course.duration,
      modules: course.modules,
      fee: course.fee,
      isActive: course.isActive,
      targetUserType: course.targetUserType,
      createdAt: course.createdAt
    });
  } catch (err) {
    console.error('Error creating course:', err);
    res.status(500).json({ 
      message: 'Failed to create course',
      error: err.message 
    });
  }
};

// Get all courses
exports.getAllCourses = async (req, res) => {
  try {
    const courses = await Course.findAll({
      include: [{
        model: User,
        as: 'instructor',
        attributes: ['firstName', 'lastName', 'email']
      }]
    });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get a single course by ID
exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'instructor',
        attributes: ['firstName', 'lastName', 'email']
      }]
    });
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update a course (admin only)
exports.updateCourse = async (req, res) => {
  try {
    const updates = { ...req.body };
    console.log('Updating course with data:', updates);
    console.log('Course ID to update:', req.params.id);
    
    // First, let's check if the course exists
    const existingCourse = await Course.findByPk(req.params.id);
    if (!existingCourse) {
      console.log('Course not found with ID:', req.params.id);
      return res.status(404).json({ message: 'Course not found' });
    }
    console.log('Existing course found:', existingCourse.toJSON());
    
    const course = await Course.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'instructor',
        attributes: ['firstName', 'lastName', 'email']
      }]
    });
    
    if (!course) {
      console.log('Course not found with ID:', req.params.id);
      return res.status(404).json({ message: 'Course not found' });
    }
    
    console.log('Found course with instructor:', course.toJSON());
    
    // Update the course with new data
    const updateResult = await course.update(updates);
    console.log('Course update result:', updateResult.toJSON());
    
    // Fetch the updated course with instructor info to ensure associations are loaded
    const updatedCourse = await Course.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'instructor',
        attributes: ['firstName', 'lastName', 'email']
      }]
    });
    
    if (!updatedCourse) {
      console.error('Failed to retrieve updated course');
      return res.status(500).json({ 
        message: 'Failed to retrieve updated course',
        error: 'Database error'
      });
    }
    
    console.log('Retrieved updated course:', updatedCourse.toJSON());
    console.log('Instructor data:', updatedCourse.instructor);
    
    // Return the updated course data
    const responseData = {
      id: updatedCourse.id,
      title: updatedCourse.title,
      description: updatedCourse.description,
      duration: updatedCourse.duration,
      modules: updatedCourse.modules,
      fee: updatedCourse.fee,
      isActive: updatedCourse.isActive,
      targetUserType: updatedCourse.targetUserType,
      createdAt: updatedCourse.createdAt,
      instructor: updatedCourse.instructor,
      students: updatedCourse.students || 0,
      rating: updatedCourse.rating || 0
    };
    
    // Validate that all required fields are present
    if (!responseData.id || !responseData.title || !responseData.description) {
      console.error('Missing required fields in response:', responseData);
      return res.status(500).json({ 
        message: 'Course update failed: Missing required fields',
        error: 'Internal server error'
      });
    }
    
    console.log('Sending response:', responseData);
    res.json(responseData);
  } catch (err) {
    console.error('Error updating course:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ 
      message: 'Failed to update course',
      error: err.message 
    });
  }
};

// Delete a course (admin only)
exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    await course.destroy();
    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};