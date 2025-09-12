const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Settings = sequelize.define('Settings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // Site Information
  siteName: {
    type: DataTypes.STRING,
    defaultValue: "IIFTL Portal"
  },
  siteDescription: {
    type: DataTypes.TEXT,
    defaultValue: "Indian Institute of Foreign Trade & Logistics"
  },
  contactEmail: {
    type: DataTypes.STRING,
    defaultValue: "info@iiftl.com"
  },
  supportPhone: {
    type: DataTypes.STRING,
    defaultValue: "+91 9043575263"
  },

  // Platform Controls
  maintenanceMode: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  maintenanceMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: ''
  },
  maintenanceEndTime: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  },
  registrationEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },

  // Notification Settings
  emailNotifications: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  smsNotifications: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  // Security Settings
  autoApproval: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  sessionTimeout: {
    type: DataTypes.INTEGER,
    defaultValue: 30 // minutes
  },
  maxFileSize: {
    type: DataTypes.INTEGER,
    defaultValue: 10 // MB
  },

  // System Settings
  databaseStatus: {
    type: DataTypes.STRING,
    defaultValue: "healthy"
  },
  lastBackup: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },

  // Payment Gateway Settings
  paymentGatewayEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  paymentGatewayProvider: {
    type: DataTypes.STRING,
    defaultValue: "razorpay"
  },
  paymentGatewayConfig: {
    type: DataTypes.JSON,
    defaultValue: {}
  },

  // Email Service Settings
  emailServiceEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  emailServiceProvider: {
    type: DataTypes.STRING,
    defaultValue: "smtp"
  },
  emailServiceConfig: {
    type: DataTypes.JSON,
    defaultValue: {}
  },

  // SMS Service Settings
  smsServiceEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  smsServiceProvider: {
    type: DataTypes.STRING,
    defaultValue: "twilio"
  },
  smsServiceConfig: {
    type: DataTypes.JSON,
    defaultValue: {}
  },

  // Analytics Settings
  analyticsEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  googleAnalyticsId: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Social Media Settings
  socialMediaLinks: {
    type: DataTypes.JSON,
    defaultValue: {
      facebook: "",
      twitter: "",
      linkedin: "",
      instagram: ""
    }
  },

  // Custom CSS/JS
  customCSS: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  customJS: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  // SEO Settings
  metaTitle: {
    type: DataTypes.STRING,
    defaultValue: "IIFTL - Indian Institute of Foreign Trade & Logistics"
  },
  metaDescription: {
    type: DataTypes.TEXT,
    defaultValue: "Professional training and certification in foreign trade and logistics"
  },
  metaKeywords: {
    type: DataTypes.TEXT,
    defaultValue: "foreign trade, logistics, certification, training, IIFTL"
  }
}, {
  timestamps: true
});

module.exports = Settings; 