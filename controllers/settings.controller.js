const { Settings, User } = require('../models');
const { Op, QueryTypes } = require('sequelize');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');


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
      
      settings = await Settings.create(req.body);
    } else {
      
      const previousMaintenance = Boolean(settings.maintenanceMode);
      const nextMaintenance = req.body.hasOwnProperty('maintenanceMode')
        ? Boolean(req.body.maintenanceMode)
        : previousMaintenance;

      await settings.update(req.body);

      
      if (!previousMaintenance && nextMaintenance) {
        const { sequelize, UserSession } = require('../models');
        
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


let maintenanceStatusCache = null;
let maintenanceStatusCacheTime = 0;
const MAINTENANCE_CACHE_DURATION = 30000; 

exports.getMaintenanceStatus = async (req, res) => {
  try {
    
    if (maintenanceStatusCache && (Date.now() - maintenanceStatusCacheTime) < MAINTENANCE_CACHE_DURATION) {
      return res.status(200).json({
        status: 'success',
        data: maintenanceStatusCache
      });
    }

    
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

    
    maintenanceStatusCache = statusData;
    maintenanceStatusCacheTime = Date.now();
    
    res.status(200).json({
      status: 'success',
      data: statusData
    });
  } catch (err) {
    console.error('Error fetching maintenance status:', err);
    
    
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
        maintenanceMessage: '', // Default empty since column doesn't exist
        maintenanceEndTime: null, // Default null since column doesn't exist
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