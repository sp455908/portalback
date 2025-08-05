const Course = require('../models/course.model');

// Create a new course (admin only)
exports.createCourse = async (req, res) => {
  try {
    const { title, description, duration, modules, fee, isActive } = req.body;
    
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
      isActive: isActive || false // Default to false if not provided
    });

    res.status(201).json({
      _id: course._id,
      title: course.title,
      description: course.description,
      duration: course.duration,
      modules: course.modules,
      fee: course.fee,
      isActive: course.isActive,
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
    const courses = await Course.find().populate('instructorId', 'firstName lastName email');
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get a single course by ID
exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate('instructorId', 'firstName lastName email');
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
    const course = await Course.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete a course (admin only)
exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};