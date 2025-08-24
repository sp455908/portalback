const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PracticeTest = sequelize.define('PracticeTest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
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
  category: {
    type: DataTypes.STRING,
    allowNull: false
  },
  questions: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  totalQuestions: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  questionsPerTest: {
    type: DataTypes.INTEGER,
    defaultValue: 10
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  passingScore: {
    type: DataTypes.INTEGER,
    defaultValue: 70
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  allowRepeat: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  repeatAfterHours: {
    type: DataTypes.INTEGER,
    defaultValue: 24
  },
  enableCooldown: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  showInPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  targetUserType: {
    type: DataTypes.ENUM('student', 'corporate', 'government'),
    allowNull: false,
    defaultValue: 'student'
  },
  courseId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Courses',
      key: 'id'
    }
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  hooks: {
    beforeUpdate: (practiceTest) => {
      practiceTest.updatedAt = new Date();
    }
  }
});

module.exports = PracticeTest; 