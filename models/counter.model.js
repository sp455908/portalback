const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Counter = sequelize.define('Counter', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  sequenceValue: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  timestamps: false
});

// Static method to get next sequence
Counter.getNextSequence = async function(key) {
  const [counter, created] = await this.findOrCreate({
    where: { id: key },
    defaults: { sequenceValue: 0 }
  });
  
  const result = await counter.increment('sequenceValue');
  return result.sequenceValue;
};

module.exports = Counter;

