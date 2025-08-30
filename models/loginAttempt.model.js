const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LoginAttempt = sequelize.define('LoginAttempt', {
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
  email: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  success: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  attemptTime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  isBlocked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  blockedUntil: {
    type: DataTypes.DATE,
    allowNull: true
  },
  blockReason: {
    type: DataTypes.STRING,
    allowNull: true
  },
  unblockedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  unblockedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['userId', 'attemptTime']
    },
    {
      fields: ['email', 'attemptTime']
    },
    {
      fields: ['isBlocked', 'blockedUntil']
    },
    {
      fields: ['ipAddress', 'attemptTime']
    }
  ]
});

// Static method to check if user is currently blocked
LoginAttempt.isUserBlocked = async function(userId) {
  const attempt = await this.findOne({
    where: {
      userId,
      isBlocked: true,
      blockedUntil: {
        [sequelize.Op.gt]: new Date()
      }
    },
    order: [['blockedUntil', 'DESC']]
  });
  
  return attempt;
};

// Static method to check if email is currently blocked
LoginAttempt.isEmailBlocked = async function(email) {
  const attempt = await this.findOne({
    where: {
      email,
      isBlocked: true,
      blockedUntil: {
        [sequelize.Op.gt]: new Date()
      }
    },
    order: [['blockedUntil', 'DESC']]
  });
  
  return attempt;
};

// Static method to get failed login attempts count for a user
LoginAttempt.getFailedAttemptsCount = async function(userId, timeWindow = 15 * 60 * 1000) { // 15 minutes default
  const since = new Date(Date.now() - timeWindow);
  
  const count = await this.count({
    where: {
      userId,
      success: false,
      attemptTime: {
        [sequelize.Op.gte]: since
      }
    }
  });
  
  return count;
};

// Static method to get failed login attempts count for an email
LoginAttempt.getFailedAttemptsCountByEmail = async function(email, timeWindow = 15 * 60 * 1000) { // 15 minutes default
  const since = new Date(Date.now() - timeWindow);
  
  const count = await this.count({
    where: {
      email,
      success: false,
      attemptTime: {
        [sequelize.Op.gte]: since
      }
    }
  });
  
  return count;
};

// Static method to block a user
LoginAttempt.blockUser = async function(userId, email, reason = 'Multiple failed login attempts', blockDurationMinutes = 15) {
  const blockedUntil = new Date(Date.now() + blockDurationMinutes * 60 * 1000);
  
  // Create a block record
  await this.create({
    userId,
    email,
    success: false,
    isBlocked: true,
    blockedUntil,
    blockReason: reason
  });
  
  return blockedUntil;
};

// Static method to unblock a user
LoginAttempt.unblockUser = async function(userId, unblockedBy) {
  const now = new Date();
  
  // Update all active blocks for this user
  await this.update(
    {
      isBlocked: false,
      blockedUntil: now,
      unblockedBy,
      unblockedAt: now
    },
    {
      where: {
        userId,
        isBlocked: true,
        blockedUntil: {
          [sequelize.Op.gt]: now
        }
      }
    }
  );
  
  return true;
};

module.exports = LoginAttempt;
