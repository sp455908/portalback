const Application = require('../models/application.model');
const User = require('../models/user.model');
const Course = require('../models/course.model');

// Create a new application (admission form)
exports.createApplication = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      gender,
      address,
      city,
      state,
      pincode,
      country,
      qualification,
      institution,
      yearOfPassing,
      percentage,
      selectedCourse,
      preferredSchedule,
      workExperience,
      motivation,
      documentsUploaded,
      agreeTerms,
      agreeMarketing
    } = req.body;

    // Optionally, associate with logged-in user
    const userId = req.user ? req.user._id : null;

    const application = await Application.create({
      userId,
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      gender,
      address,
      city,
      state,
      pincode,
      country,
      qualification,
      institution,
      yearOfPassing,
      percentage,
      selectedCourse,
      preferredSchedule,
      workExperience,
      motivation,
      documentsUploaded,
      agreeTerms,
      agreeMarketing,
      status: "pending",
      submittedAt: new Date()
    });

    res.status(201).json(application);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all applications (admin only)
exports.getAllApplications = async (req, res) => {
  try {
    const applications = await Application.find().sort({ submittedAt: -1 });
    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get application by ID (admin or owner)
exports.getApplicationById = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });

    // Only admin or owner can view
    if (
      req.user.role !== "admin" &&
      (!application.userId || application.userId.toString() !== req.user._id.toString())
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(application);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update application status (admin only)
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { status, notes },
      { new: true }
    );
    if (!application) return res.status(404).json({ message: "Application not found" });
    res.json(application);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete application (admin only)
exports.deleteApplication = async (req, res) => {
  try {
    const application = await Application.findByIdAndDelete(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });
    res.json({ message: "Application deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get applications for current user
exports.getMyApplications = async (req, res) => {
  try {
    const applications = await Application.find({ userId: req.user._id }).sort({ submittedAt: -1 });
    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};