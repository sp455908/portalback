const Settings = require('../models/settings.model');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Add error handling for missing dependencies
if (!Settings) {
  console.error('Settings model not found');
}

exports.getSettings = catchAsync(async (req, res) => {
  try {
    const settings = await Settings.getInstance();
    
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
  const settings = await Settings.getInstance();
  
  // Update settings with provided data
  Object.assign(settings, req.body);
  settings.updatedBy = req.user._id;
  settings.updatedAt = new Date();
  
  await settings.save();
  
  res.status(200).json({
    status: 'success',
    message: 'Settings updated successfully',
    data: {
      settings
    }
  });
});

exports.getMaintenanceStatus = catchAsync(async (req, res) => {
  try {
    console.log('getMaintenanceStatus called');
    const settings = await Settings.getInstance();
    console.log('Settings loaded:', settings);
    
    res.status(200).json({
      status: 'success',
      data: {
        maintenanceMode: settings.maintenanceMode || false,
        registrationEnabled: settings.registrationEnabled !== false // Default to true
      }
    });
  } catch (error) {
    console.error('Error in getMaintenanceStatus:', error);
    // Return default values if settings can't be loaded
    res.status(200).json({
      status: 'success',
      data: {
        maintenanceMode: false,
        registrationEnabled: true
      }
    });
  }
});

exports.checkRegistrationEnabled = catchAsync(async (req, res, next) => {
  const settings = await Settings.getInstance();
  
  if (!settings.registrationEnabled) {
    return next(new AppError('User registration is currently disabled', 403));
  }
  
  next();
});

exports.checkMaintenanceMode = catchAsync(async (req, res, next) => {
  const settings = await Settings.getInstance();
  
  if (settings.maintenanceMode) {
    return next(new AppError('Platform is currently under maintenance', 503));
  }
  
  next();
});

exports.resetSettings = catchAsync(async (req, res) => {
  const settings = await Settings.getInstance();
  
  // Reset to default values
  settings.siteName = "IIFTL Portal";
  settings.siteDescription = "Indian Institute of Foreign Trade & Logistics";
  settings.contactEmail = "info@iiftl.com";
  settings.supportPhone = "+91 9043575263";
  settings.maintenanceMode = false;
  settings.registrationEnabled = true;
  settings.emailNotifications = true;
  settings.smsNotifications = false;
  settings.autoApproval = false;
  settings.sessionTimeout = 30;
  settings.maxFileSize = 10;
  settings.updatedBy = req.user._id;
  settings.updatedAt = new Date();
  
  await settings.save();
  
  res.status(200).json({
    status: 'success',
    message: 'Settings reset to defaults',
    data: {
      settings
    }
  });
}); 