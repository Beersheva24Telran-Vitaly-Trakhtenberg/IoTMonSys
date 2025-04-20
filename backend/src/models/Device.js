import mongoose from 'mongoose';
import { DATA_TYPES, DEVICE_TYPES } from '../constants/deviceTypes.js';

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
  thresholds: { // ToDo: Add for 'pressure', 'sound', 'vibration', 'opening', 'air_quality'
    temperature: {
      min: { type: Number, default: -30 },
      max: { type: Number, default: 50 },
    },
    humidity: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 100 },
    },
    light: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 10000 },
    },
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

const Device = mongoose.model('Device', deviceSchema);

export default Device;