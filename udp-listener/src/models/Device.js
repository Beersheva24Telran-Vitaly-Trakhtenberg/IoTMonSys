const mongoose = require('mongoose');
const { DATA_TYPES, DEVICE_TYPES } = require('../constants/deviceTypes');

const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  brandName: {
    type: String,
    required: false,
    trim: true,
  },
  model: {
    type: String,
    required: false,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    required: true,
    enum: DEVICE_TYPES,
    default: DATA_TYPES.TEMPERATURE,
  },
  location: {
    type: String,
    required: false,
    trim: true,
  },
  status: {
    type: String,
    enum: [
      'active',
      'inactive',
      'broken',
      'maintenance'
    ],
    default: 'active',
  },
  thresholds: {
    temperature: {
      min: { type: Number, default: -30 },  // grad C
      max: { type: Number, default: 50 },  // grad C
    },
    humidity: {
      min: { type: Number, default: 0 }, // %
      max: { type: Number, default: 100 }, // %
    },
    light: {
      min: { type: Number, default: 0 },  // lx
      max: { type: Number, default: 10000 },  // lx
    },
    pressure: {
      min: { type: Number, default: 970 }, // gPa
      max: { type: Number, default: 1040 }, // gPa
    },
    sound: {
      min: { type: Number, default: 0 }, // dB
      max: { type: Number, default: 80 }, // dB
    },
    vibration: {
      min: { type: Number, default: 0 }, // g
      max: { type: Number, default: 2 }, // g
    },
    opening: {
      min: { type: Number, default: 0 }, // binary
      max: { type: Number, default: 1 }, // binary
    },
    air_quality: {
      min: { type: Number, default: 0 }, // AQI
      max: { type: Number, default: 200 }, // AQI
    }
  },
  powerType: {
    type: String,
    enum: [
      'battery',
      'solar',
      'electricity',
      'without',
      'other'
    ],
    default: 'battery',
  },
  direction: {
    type: String,
    enum: [
      'out',
      'in',
      'both'
    ],
    default: 'out',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  lastDataReceived: {
    type: Date,
    default: null,
  },
  ownerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
});

deviceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

deviceSchema.index({ deviceId: 1, timestamp: -1 });

module.exports = mongoose.model('Device', deviceSchema);