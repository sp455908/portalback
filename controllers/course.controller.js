const { Course, User } = require('../models');

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
    const course = await Course.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'instructor',
        attributes: ['firstName', 'lastName', 'email']
      }]
    });
    if (!course) return res.status(404).json({ message: 'Course not found' });
    
    // Update the course with new data
    await course.update(updates);
    
    // Fetch the updated course with instructor info
    const updatedCourse = await Course.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'instructor',
        attributes: ['firstName', 'lastName', 'email']
      }]
    });
    
    res.json(updatedCourse);
  } catch (err) {
    res.status(500).json({ message: err.message });
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