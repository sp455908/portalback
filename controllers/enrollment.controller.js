const { Enrollment, Course, User } = require('../models');

// Enroll a user in a course
exports.createEnrollment = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user.id;

    // Check if already enrolled
    const existing = await Enrollment.findOne({ where: { userId, courseId } });
    if (existing) {
      return res.status(400).json({ message: "Already enrolled in this course" });
    }

    // Optionally, check if course exists and is active
    const course = await Course.findByPk(courseId);
    if (!course || !course.isActive) {
      return res.status(404).json({ message: "Course not found or inactive" });
    }

    const enrollment = await Enrollment.create({ userId, courseId });
    res.status(201).json(enrollment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all enrollments (admin only)
exports.getAllEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.findAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['firstName', 'lastName', 'email']
        },
        {
          model: Course,
          as: 'course',
          attributes: ['title']
        }
      ]
    });
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get current user's enrollments
exports.getMyEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Course,
        as: 'course',
        attributes: ['title', 'duration', 'level']
      }]
    });
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update enrollment (admin only)
exports.updateEnrollment = async (req, res) => {
  try {
    const updates = { ...req.body };
    const enrollment = await Enrollment.findByPk(req.params.id);
    if (!enrollment) return res.status(404).json({ message: 'Enrollment not found' });
    await enrollment.update(updates);
    if (!enrollment) return res.status(404).json({ message: 'Enrollment not found' });
    res.json(enrollment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete enrollment (admin/instructor)
exports.deleteEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findByPk(req.params.id);
    if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });
    await enrollment.destroy();
    if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });
    res.json({ message: "Enrollment deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};