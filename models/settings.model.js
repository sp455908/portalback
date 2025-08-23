const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // Site Information
  siteName: {
    type: String,
    default: "IIFTL Portal"
  },
  siteDescription: {
    type: String,
    default: "Indian Institute of Foreign Trade & Logistics"
  },
  contactEmail: {
    type: String,
    default: "info@iiftl.com"
  },
  supportPhone: {
    type: String,
    default: "+91 9043575263"
  },

  // Platform Controls
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  registrationEnabled: {
    type: Boolean,
    default: true
  },

  // Notification Settings
  emailNotifications: {
    type: Boolean,
    default: true
  },
  smsNotifications: {
    type: Boolean,
    default: false
  },

  // Security Settings
  autoApproval: {
    type: Boolean,
    default: false
  },
  sessionTimeout: {
    type: Number,
    default: 30 // minutes
  },
  maxFileSize: {
    type: Number,
    default: 10 // MB
  },

  // System Settings
  databaseStatus: {
    type: String,
    default: "healthy"
  },
  lastBackup: {
    type: Date,
    default: Date.now
  },

  // Integration Settings
  paymentGateway: {
    enabled: {
      type: Boolean,
      default: false
    },
    provider: {
      type: String,
      default: "razorpay"
    },
    config: {
      type: Object,
      default: {}
    }
  },

  emailService: {
    enabled: {
      type: Boolean,
      default: false
    },
    provider: {
      type: String,
      default: "smtp"
    },
    config: {
      type: Object,
      default: {}
    }
  },

  smsService: {
    enabled: {
      type: Boolean,
      default: false
    },
    provider: {
      type: String,
      default: "twilio"
    },
    config: {
      type: Object,
      default: {}
    }
  },

  // Metadata
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
settingsSchema.statics.getInstance = async function() {
  try {
    console.log('Settings.getInstance called');
    let settings = await this.findOne();
    console.log('Found settings:', settings);
    if (!settings) {
      console.log('Creating new settings document');
      settings = await this.create({});
      console.log('Created settings:', settings);
    }
    return settings;
  } catch (error) {
    console.error('Error in Settings.getInstance:', error);
    throw error;
  }
};

module.exports = mongoose.model('Settings', settingsSchema); 