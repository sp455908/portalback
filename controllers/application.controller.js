const { Application, User, Course } = require('../models');

// Create a new application (admission form)
exports.createApplication = async (req, res) => {
  try {
    const encryptionService = require('../utils/encryption');
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
    const userId = req.user ? req.user.id : null;

    const application = await Application.create({
      userId,
      firstName,
      lastName,
      email,
      phone: phone ? encryptionService.encrypt(String(phone)) : phone,
      dateOfBirth,
      gender,
      address: address ? encryptionService.encrypt(String(address)) : address,
      city,
      state,
      pincode: pincode ? encryptionService.encrypt(String(pincode)) : pincode,
      country,
      qualification,
      institution,
      yearOfPassing,
      percentage,
      selectedCourse,
      preferredSchedule,
      workExperience,
      motivation: motivation ? encryptionService.encrypt(String(motivation)) : motivation,
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
    const applications = await Application.findAll({
      order: [['submittedAt', 'DESC']]
    });
    // Decrypt sensitive fields before sending
    const encryptionService = require('../utils/encryption');
    const decrypted = applications.map((app) => {
      const json = app.toJSON();
      return {
        ...json,
        phone: json.phone ? encryptionService.safeDecrypt(String(json.phone)) : json.phone,
        address: json.address ? encryptionService.decrypt(String(json.address)) : json.address,
        pincode: json.pincode ? encryptionService.decrypt(String(json.pincode)) : json.pincode,
        motivation: json.motivation ? encryptionService.decrypt(String(json.motivation)) : json.motivation
      };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get application by ID (admin or owner)
exports.getApplicationById = async (req, res) => {
  try {
    const application = await Application.findByPk(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });

    // Only admin or owner can view
    if (
      req.user.role !== "admin" &&
      (!application.userId || application.userId.toString() !== req.user.id.toString())
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const encryptionService = require('../utils/encryption');
    const json = application.toJSON();
    const decrypted = {
      ...json,
      phone: json.phone ? encryptionService.safeDecrypt(String(json.phone)) : json.phone,
      address: json.address ? encryptionService.decrypt(String(json.address)) : json.address,
      pincode: json.pincode ? encryptionService.decrypt(String(json.pincode)) : json.pincode,
      motivation: json.motivation ? encryptionService.decrypt(String(json.motivation)) : json.motivation
    };
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update application status (admin only)
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const application = await Application.findByPk(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });
    await application.update({ status, notes });
    if (!application) return res.status(404).json({ message: "Application not found" });
    res.json(application);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete application (admin only)
exports.deleteApplication = async (req, res) => {
  try {
    const application = await Application.findByPk(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });
    await application.destroy();
    if (!application) return res.status(404).json({ message: "Application not found" });
    res.json({ message: "Application deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get applications for current user
exports.getMyApplications = async (req, res) => {
  try {
    const applications = await Application.findAll({
      where: { userId: req.user.id },
      order: [['submittedAt', 'DESC']]
    });
    const encryptionService = require('../utils/encryption');
    const decrypted = applications.map((app) => {
      const json = app.toJSON();
      return {
        ...json,
        phone: json.phone ? encryptionService.safeDecrypt(String(json.phone)) : json.phone,
        address: json.address ? encryptionService.decrypt(String(json.address)) : json.address,
        pincode: json.pincode ? encryptionService.decrypt(String(json.pincode)) : json.pincode,
        motivation: json.motivation ? encryptionService.decrypt(String(json.motivation)) : json.motivation
      };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};