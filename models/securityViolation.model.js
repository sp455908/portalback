const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SecurityViolation = sequelize.define('SecurityViolation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  testAttemptId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'TestAttempts',
      key: 'id'
    }
  },
  practiceTestId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'PracticeTests',
      key: 'id'
    }
  },
  violationType: {
    type: DataTypes.ENUM('tab_switch', 'window_switch', 'copy_paste', 'right_click', 'developer_tools'),
    allowNull: false
  },
  violationCount: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  isBlocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  blockedUntil: {
    type: DataTypes.DATE,
    allowNull: true
  },
  blockDurationHours: {
    type: DataTypes.INTEGER,
    defaultValue: 24
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  windowTitle: {
    type: DataTypes.STRING,
    allowNull: true
  },
  screenSize: {
    type: DataTypes.STRING,
    allowNull: true
  },
  browserInfo: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['userId', 'violationType', 'timestamp']
    },
    {
      fields: ['userId', 'isBlocked', 'blockedUntil']
    },
    {
      fields: ['testAttemptId', 'violationType']
    }
  ]
});

// Static method to check if user is currently blocked
SecurityViolation.isUserBlocked = async function(userId, violationType = 'tab_switch') {
  const violation = await this.findOne({
    where: {
      userId,
      violationType,
      isBlocked: true,
      blockedUntil: {
        [sequelize.Op.gt]: new Date()
      }
    },
    order: [['blockedUntil', 'DESC']]
  });
  
  return violation;
};

// Static method to get remaining block time
SecurityViolation.getRemainingBlockTime = async function(userId, violationType = 'tab_switch') {
  const violation = await this.isUserBlocked(userId, violationType);
  if (!violation) return null;
  
  const now = new Date();
  const remainingMs = violation.blockedUntil.getTime() - now.getTime();
  const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
  
  return {
    blockedUntil: violation.blockedUntil,
    remainingMs,
    remainingHours,
    violation
  };
};

module.exports = SecurityViolation;