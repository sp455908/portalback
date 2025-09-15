const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TestAttempt = sequelize.define('TestAttempt', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  guestName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  guestEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  practiceTestId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'PracticeTests',
      key: 'id'
    }
  },
  testTitle: {
    type: DataTypes.STRING,
    allowNull: false
  },
  answers: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  questionsAsked: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  score: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  obtainedMarks: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  testSettingsSnapshot: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Snapshot of test settings at the time of attempt'
  },
  totalQuestions: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  correctAnswers: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  wrongAnswers: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  timeTaken: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  maxTime: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('in_progress', 'completed', 'timeout', 'abandoned'),
    defaultValue: 'in_progress'
  },
  passed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  attemptsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['userId', 'practiceTestId', 'createdAt']
    },
    {
      fields: ['userId', 'startedAt']
    }
  ]
});

module.exports = TestAttempt; 