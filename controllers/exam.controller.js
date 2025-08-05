const Exam = require('../models/exam.model');

// Create a new exam (admin only)
exports.createExam = async (req, res) => {
  try {
    const {
      title,
      courseId,
      date,
      duration,
      questions,
      description,
      instructorId,
      fee,
      status,
      venue,
      passingScore,
      maxMarks,
      targetUserType
    } = req.body;

    if (!targetUserType) {
      return res.status(400).json({ message: 'targetUserType is required (student, corporate, or government)' });
    }

    if (!['student', 'corporate', 'government'].includes(targetUserType)) {
      return res.status(400).json({ message: 'targetUserType must be student, corporate, or government' });
    }

    const exam = await Exam.create({
      title,
      courseId,
      date,
      duration,
      questions,
      description,
      instructorId,
      fee,
      status,
      venue,
      passingScore,
      maxMarks,
      targetUserType
    });

    res.status(201).json(exam);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all exams
exports.getAllExams = async (req, res) => {
  try {
    const exams = await Exam.find()
      .populate('courseId', 'title')
      .populate('instructorId', 'firstName lastName email');
    res.json(exams);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get a single exam by ID
exports.getExamById = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('courseId', 'title')
      .populate('instructorId', 'firstName lastName email');
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    res.json(exam);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update an exam (admin only)
exports.updateExam = async (req, res) => {
  try {
    const updates = { ...req.body };
    const exam = await Exam.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    res.json(exam);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete an exam (admin only)
exports.deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findByIdAndDelete(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    res.json({ message: 'Exam deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};