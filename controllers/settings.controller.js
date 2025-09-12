const { Settings, User } = require('../models');
const { Op, QueryTypes } = require('sequelize');
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
        const { sequelize, UserSession } = require('../models');
        // Find non-admin/owner users and kill their active sessions
        const rows = await sequelize.query(
          `SELECT us.id AS "sessionIdPk" FROM "UserSessions" us
           INNER JOIN "Users" u ON u.id = us."userId"
           WHERE us."isActive" = true AND u.role <> 'admin'`,
          { type: QueryTypes.SELECT }
        );
        if (Array.isArray(rows) && rows.length) {
          await UserSession.update({ isActive: false }, {
            where: { id: rows.map(r => r.sessionIdPk) }
          });
        }
        // No fallback mass deactivation to avoid affecting admins triggering the change
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

// ✅ OPTIMIZED: Get maintenance status with caching and fast response
let maintenanceStatusCache = null;
let maintenanceStatusCacheTime = 0;
const MAINTENANCE_CACHE_DURATION = 30000; // 30 seconds cache

exports.getMaintenanceStatus = async (req, res) => {
  try {
    // Check cache first
    if (maintenanceStatusCache && (Date.now() - maintenanceStatusCacheTime) < MAINTENANCE_CACHE_DURATION) {
      return res.status(200).json({
        status: 'success',
        data: maintenanceStatusCache
      });
    }

    // Set a timeout for the database query
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database query timeout')), 1000)
    );

    const queryPromise = Settings.findOne({
      attributes: ['maintenanceMode', 'maintenanceMessage', 'maintenanceEndTime', 'registrationEnabled']
    });

    const settings = await Promise.race([queryPromise, timeoutPromise]);
    
    const statusData = {
      maintenanceMode: settings?.maintenanceMode || false,
      maintenanceMessage: settings?.maintenanceMessage || '',
      maintenanceEndTime: settings?.maintenanceEndTime || null,
      registrationEnabled: settings?.registrationEnabled || true
    };

    // Update cache
    maintenanceStatusCache = statusData;
    maintenanceStatusCacheTime = Date.now();
    
    res.status(200).json({
      status: 'success',
      data: statusData
    });
  } catch (err) {
    console.error('Error fetching maintenance status:', err);
    
    // Return cached data if available, otherwise default
    if (maintenanceStatusCache) {
      return res.status(200).json({
        status: 'success',
        data: maintenanceStatusCache
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        maintenanceMode: false,
        maintenanceMessage: '',
        maintenanceEndTime: null,
        registrationEnabled: true
      }
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