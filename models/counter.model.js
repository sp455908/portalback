const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequenceValue: { type: Number, default: 0 }
});

counterSchema.statics.getNextSequence = async function(key) {
  const result = await this.findOneAndUpdate(
    { _id: key },
    { $inc: { sequenceValue: 1 } },
    { new: true, upsert: true }
  );
  return result.sequenceValue;
};

module.exports = mongoose.model('Counter', counterSchema);

