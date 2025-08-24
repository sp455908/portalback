const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserTestCooldown = sequelize.define('UserTestCooldown', {
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
  testId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'PracticeTests',
      key: 'id'
    }
  },
  cooldownHours: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 24
  },
  setBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  setAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['userId', 'testId']
    }
  ]
});

module.exports = UserTestCooldown; 