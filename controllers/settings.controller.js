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
      const previousMaintenance = Boolean(settings.maintenanceMode);
      const nextMaintenance = req.body.hasOwnProperty('maintenanceMode')
        ? Boolean(req.body.maintenanceMode)
        : previousMaintenance;

      await settings.update(req.body);

      // If maintenance mode toggled ON, deactivate all non-admin/owner sessions
      if (!previousMaintenance && nextMaintenance) {
        const { sequelize, UserSession, User } = require('../models');
        // Find non-admin/owner users and kill their active sessions
        const [rows] = await sequelize.query(
          `SELECT us.id AS "sessionIdPk" FROM "UserSessions" us
           INNER JOIN "Users" u ON u.id = us."userId"
           WHERE us."isActive" = true AND u.role NOT IN ('admin','owner')`
        );
        if (Array.isArray(rows) && rows.length) {
          await UserSession.update({ isActive: false }, {
            where: { id: rows.map(r => r.sessionIdPk) }
          });
        } else {
          // Fallback: bulk deactivate by join conditions
          await UserSession.update({ isActive: false }, {
            where: { isActive: true }
          });
          // Re-activate admin/owner sessions if needed
          const adminOwnerIds = (await User.findAll({ where: { role: ['admin','owner'] }, attributes: ['id'] }))
            .map(u => u.id);
          if (adminOwnerIds.length) {
            await UserSession.update({ isActive: true }, { where: { userId: adminOwnerIds } });
          }
        }
      }
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
        maintenanceEndTime: settings?.maintenanceEndTime || null,
        registrationEnabled: settings?.registrationEnabled || true
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
    // Allow only admin/owner to pass; block others
    const role = req.user?.role;
    if (role === 'admin' || role === 'owner') {
      return next();
    }
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