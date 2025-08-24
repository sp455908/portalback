const { Settings, User } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Add error handling for missing dependencies
if (!Settings) {
  console.error('Settings model not found');
}

exports.getSettings = catchAsync(async (req, res) => {
  try {
    const settings = await Settings.findOne();
    
    res.status(200).json({
      status: 'success',
      data: {
        settings
      }
    });
  } catch (error) {
    console.error('Error in getSettings:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

exports.updateSettings = catchAsync(async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    if (!settings) {
      // Create default settings if none exist
      settings = await Settings.create(req.body);
    } else {
      // Update existing settings
      await settings.update(req.body);
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Settings updated successfully',
      data: {
        settings
      }
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update settings'
    });
  }
});

// Get maintenance status
exports.getMaintenanceStatus = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    
    res.status(200).json({
      status: 'success',
      data: {
        maintenanceMode: settings?.maintenanceMode || false,
        maintenanceMessage: settings?.maintenanceMessage || '',
        maintenanceEndTime: settings?.maintenanceEndTime || null
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch maintenance status'
    });
  }
};

exports.checkRegistrationEnabled = catchAsync(async (req, res, next) => {
  const settings = await Settings.findOne();
  
  if (settings && !settings.registrationEnabled) {
    return next(new AppError('User registration is currently disabled', 403));
  }
  
  next();
});

exports.checkMaintenanceMode = catchAsync(async (req, res, next) => {
  const settings = await Settings.findOne();
  
  if (settings && settings.maintenanceMode) {
    return next(new AppError('Platform is currently under maintenance', 503));
  }
  
  next();
});

exports.resetSettings = catchAsync(async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    if (!settings) {
      // Create default settings
      settings = await Settings.create({
        siteName: "IIFTL Portal",
        siteDescription: "Indian Institute of Foreign Trade & Logistics",
        contactEmail: "info@iiftl.com",
        supportPhone: "+91 9043575263",
        maintenanceMode: false,
        registrationEnabled: true,
        emailNotifications: true,
        smsNotifications: false,
        autoApproval: false,
        sessionTimeout: 30,
        maxFileSize: 10
      });
    } else {
      // Reset to default values
      await settings.update({
        siteName: "IIFTL Portal",
        siteDescription: "Indian Institute of Foreign Trade & Logistics",
        contactEmail: "info@iiftl.com",
        supportPhone: "+91 9043575263",
        maintenanceMode: false,
        registrationEnabled: true,
        emailNotifications: true,
        smsNotifications: false,
        autoApproval: false,
        sessionTimeout: 30,
        maxFileSize: 10
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Settings reset to defaults',
      data: {
        settings
      }
    });
  } catch (error) {
    console.error('Error resetting settings:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reset settings'
    });
  }
}); 

// Get single admin status
exports.getSingleAdminStatus = async (req, res) => {
  try {
    const adminCount = await User.count({ where: { role: 'admin' } });
    
    res.status(200).json({
      status: 'success',
      data: {
        singleAdminOnly: true,
        currentAdminCount: adminCount,
        canCreateAdmin: adminCount === 0,
        message: adminCount === 0 
          ? 'No admin user exists. You can create one.' 
          : 'Admin user already exists. Only one admin allowed.'
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to get single admin status'
    });
  }
}; 