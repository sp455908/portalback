const { DataTypes, Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
      notEmpty: true
    }
    ,
    set(value) {
      if (typeof value === 'string') {
        this.setDataValue('email', value.trim().toLowerCase());
      } else {
        this.setDataValue('email', value);
      }
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('student', 'admin', 'corporate', 'government'),
    allowNull: false
  },
  userType: {
    type: DataTypes.ENUM('student', 'corporate', 'government'),
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  profileImage: {
    type: DataTypes.STRING,
    allowNull: true
  },
  studentId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'Users', // Explicitly set table name to match database
  timestamps: true, // This will create createdAt and updatedAt
  hooks: {
    beforeCreate: async (user) => {
      const Counter = require('./counter.model');
      // Check single admin rule
      if (user.role === 'admin') {
        const adminCount = await User.count({ where: { role: 'admin' } });
        if (adminCount > 0) {
          throw new Error('Only one admin user is allowed in the system');
        }
      }
      
      // Generate student ID for new students using atomic counter
      if (user.role === 'student' && !user.studentId) {
        const year = new Date().getFullYear();
        const seq = await Counter.getNextSequence(`student:${year}`);
        user.studentId = `IIFTL-${year}-${String(seq).padStart(5, '0')}`;
      }
      
      // Hash password
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    },
    beforeUpdate: async (user) => {
      // Check single admin rule when updating role to admin
      if (user.changed('role') && user.role === 'admin') {
        const adminCount = await User.count({ 
          where: { 
            role: 'admin',
            id: { [Op.ne]: user.id } // Exclude current user
          } 
        });
        if (adminCount > 0) {
          throw new Error('Only one admin user is allowed in the system');
        }
      }
      
      // Hash password if it's being updated
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    }
  }
});

// Instance method to compare password
User.prototype.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = User;