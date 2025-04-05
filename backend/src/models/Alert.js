import mongoose from 'mongoose';
import { ALERT_TYPES } from '../constants/deviceTypes.js';

const alertSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    ref: 'Device',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  type: {
    type: String,
    required: true,
    enum: ALERT_TYPES
  },
  severity: {
    type: String,
    required: true,
    enum: ['info', 'warning', 'critical'],
    default: 'warning',
  },
  message: {
    type: String,
    required: true,
  },
  value: {
    type: Number,
    required: false,
  },
  threshold: {  // ?
    type: Number,
    required: false,
  },
  status: { // ?
    type: String,
    enum: ['new', 'acknowledged', 'resolved'],
    default: 'new',
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  acknowledgedAt: {
    type: Date,
    default: null,
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
});

alertSchema.index({ deviceId: 1, timestamp: -1 });
alertSchema.index({ status: 1 });

const Alert = mongoose.model('Alert', alertSchema);

export default Alert;