import mongoose from 'mongoose';
import { DATA_VARIANTS } from '../constants/deviceTypes.js';

const deviceDataSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    ref: 'Device',
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: DATA_VARIANTS,
  },
  value: {
    type: Number,
    required: true,
  },
  isAnomaly: {
    type: Boolean,
    default: false,
  },
  anomalyDetails: {
    type: String,
    default: null,
  },
});

deviceDataSchema.index({ deviceId: 1, timestamp: -1 });

const DeviceData = mongoose.model('DeviceData', deviceDataSchema);

export default DeviceData;
