const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BatchStudent = sequelize.define('BatchStudent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  batchId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Batches',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  enrolledAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'completed', 'dropped'),
    defaultValue: 'active'
  }
}, {
  timestamps: true,
  tableName: 'BatchStudents'
});

module.exports = BatchStudent; 