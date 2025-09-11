const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

// "Owner" table holds superadmin. Not part of Users and never exposed in user listings.
const Owner = sequelize.define('Owner', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true, notEmpty: true },
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
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'Owner',
  timestamps: true,
  hooks: {
    beforeCreate: async (owner) => {
      if (owner.password) {
        owner.password = await bcrypt.hash(owner.password, 12);
      }
    },
    beforeUpdate: async (owner) => {
      if (owner.changed('password')) {
        owner.password = await bcrypt.hash(owner.password, 12);
      }
    }
  }
});

Owner.prototype.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = Owner;

