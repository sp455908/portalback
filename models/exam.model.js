const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Exam = sequelize.define('Exam', {
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
  courseId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Courses',
      key: 'id'
    }
  },
  date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  duration: {
    type: DataTypes.STRING,
    allowNull: false
  },
  questions: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  instructorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  fee: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'completed', 'cancelled'),
    defaultValue: 'scheduled'
  },
  targetUserType: {
    type: DataTypes.ENUM('student', 'corporate', 'government'),
    allowNull: false
  },
  venue: {
    type: DataTypes.STRING,
    allowNull: true
  },
  passingScore: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  maxMarks: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  }
}, {
  timestamps: true,
  hooks: {
    beforeUpdate: (exam) => {
      exam.updatedAt = new Date();
    }
  }
});

module.exports = Exam;