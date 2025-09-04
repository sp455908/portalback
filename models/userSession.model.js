const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserSession = sequelize.define('UserSession', {
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
    },
    onDelete: 'CASCADE'
  },
  sessionId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  accessToken: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  refreshToken: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  lastActivity: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  deviceInfo: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'UserSessions',
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['sessionId']
    },
    {
      fields: ['lastActivity']
    },
    {
      fields: ['expiresAt']
    },
    {
      fields: ['isActive']
    }
  ]
});

// Instance methods
UserSession.prototype.updateActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

UserSession.prototype.isExpired = function() {
  return new Date() > this.expiresAt;
};

UserSession.prototype.isIdle = function(idleTimeoutMinutes = 30) {
  const now = new Date();
  const lastActivity = new Date(this.lastActivity);
  const idleTime = (now - lastActivity) / (1000 * 60); // minutes
  return idleTime > idleTimeoutMinutes;
};

// Static methods
UserSession.findActiveSession = async function(userId, sessionId) {
  return await this.findOne({
    where: {
      userId,
      sessionId,
      isActive: true,
      expiresAt: {
        [require('sequelize').Op.gt]: new Date()
      }
    }
  });
};

UserSession.findUserActiveSessions = async function(userId) {
  return await this.findAll({
    where: {
      userId,
      isActive: true,
      expiresAt: {
        [require('sequelize').Op.gt]: new Date()
      }
    },
    order: [['lastActivity', 'DESC']]
  });
};

UserSession.deactivateUserSessions = async function(userId, excludeSessionId = null) {
  const whereClause = {
    userId,
    isActive: true
  };
  
  if (excludeSessionId) {
    whereClause.sessionId = {
      [require('sequelize').Op.ne]: excludeSessionId
    };
  }
  
  return await this.update(
    { isActive: false },
    { where: whereClause }
  );
};

UserSession.cleanupExpiredSessions = async function() {
  return await this.update(
    { isActive: false },
    {
      where: {
        [require('sequelize').Op.or]: [
          { expiresAt: { [require('sequelize').Op.lt]: new Date() } },
          { isActive: true }
        ]
      }
    }
  );
};

UserSession.createSession = async function(sessionData) {
  const session = await this.create(sessionData);
  return session;
};

module.exports = UserSession;
