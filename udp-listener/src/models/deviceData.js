const mongoose = require('mongoose');
const { DATA_VARIANTS } = require('../constants/deviceTypes');

const deviceDataSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: DATA_VARIANTS
  },
  value: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  batteryLevel: {
    type: Number,
    min: 0,
    max: 100
  },
  receivedAt: {
    type: Date,
    default: Date.now
  }
});

deviceDataSchema.index({ deviceId: 1, timestamp: -1 });

module.exports = mongoose.model('DeviceData', deviceDataSchema);