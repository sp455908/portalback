const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

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
  tableName: 'LoginAttempts', // Explicitly set table name
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

// OPTIMIZED: Single method to get all blocking info and failed attempts count
LoginAttempt.getLoginStatus = async function(userId, email, timeWindow = 15 * 60 * 1000) {
  const since = new Date(Date.now() - timeWindow);
  
  // Single query to get all needed information
  const [blockedUser, blockedEmail, failedAttempts] = await Promise.all([
    // Check if user is blocked
    this.findOne({
      where: {
        userId,
        isBlocked: true,
        blockedUntil: {
          [Op.gt]: new Date()
        }
      },
      order: [['blockedUntil', 'DESC']],
      attributes: ['blockedUntil', 'blockReason']
    }),
    
    // Check if email is blocked
    this.findOne({
      where: {
        email,
        isBlocked: true,
        blockedUntil: {
          [Op.gt]: new Date()
        }
      },
      order: [['blockedUntil', 'DESC']],
      attributes: ['blockedUntil', 'blockReason']
    }),
    
    // Get failed attempts count
    this.count({
      where: {
        userId,
        success: false,
        attemptTime: {
          [Op.gte]: since
        }
      }
    })
  ]);
  
  return {
    isUserBlocked: !!blockedUser,
    isEmailBlocked: !!blockedEmail,
    userBlockedUntil: blockedUser?.blockedUntil,
    emailBlockedUntil: blockedEmail?.blockedUntil,
    userBlockReason: blockedUser?.blockReason,
    emailBlockReason: blockedEmail?.blockReason,
    failedAttemptsCount: failedAttempts
  };
};

// OPTIMIZED: Single method to create login attempt and check blocking
LoginAttempt.processLoginAttempt = async function(loginData) {
  const { userId, email, ipAddress, userAgent, success, timeWindow = 15 * 60 * 1000 } = loginData;
  
  // Create login attempt record
  const attempt = await this.create({
    userId,
    email,
    ipAddress,
    userAgent,
    success,
    attemptTime: new Date()
  });
  
  // If failed attempt, check if user should be blocked
  if (!success) {
    const since = new Date(Date.now() - timeWindow);
    const failedCount = await this.count({
      where: {
        userId,
        success: false,
        attemptTime: {
          [Op.gte]: since
        }
      }
    });
    
    // Return blocking info if threshold reached
    if (failedCount >= 5) {
      return {
        attempt,
        shouldBlock: true,
        failedCount,
        message: 'Account temporarily blocked due to multiple failed login attempts. Please try again in 15 minutes or contact an administrator.'
      };
    }
  }
  
  return {
    attempt,
    shouldBlock: false
  };
};

// Static method to check if user is currently blocked
LoginAttempt.isUserBlocked = async function(userId) {
  const attempt = await this.findOne({
    where: {
      userId,
      isBlocked: true,
      blockedUntil: {
        [Op.gt]: new Date()
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
        [Op.gt]: new Date()
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
        [Op.gte]: since
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
        [Op.gte]: since
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
          [Op.gt]: now
        }
      }
    }
  );
  
  return true;
};

module.exports = LoginAttempt;
