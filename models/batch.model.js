const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Batch = sequelize.define('Batch', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  batchId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },
  batchName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  userType: {
    type: DataTypes.ENUM('student', 'corporate', 'government'),
    allowNull: false,
    defaultValue: 'student',
    validate: {
      isIn: [['student', 'corporate', 'government']]
    }
  },
  adminId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  maxStudents: {
    type: DataTypes.INTEGER,
    defaultValue: 50,
    validate: {
      min: 1,
      max: 200
    }
  },
  allowTestRetakes: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  requireCompletion: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  autoAssignTests: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  emailNotifications: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  testReminders: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  dueDateAlerts: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'completed', 'archived'),
    defaultValue: 'active'
  },
  startDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Batch; 