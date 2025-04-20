import mongoose from 'mongoose';

const applicationErrorSchema = new mongoose.Schema({
  source: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
  },
  stackTrace: {
    type: String,
    required: false,
  },
  timestampFirstSeen: {
    type: Date,
    default: Date.now,
  },
  timestampLastSeen: {
    type: Date,
    default: Date.now,
  },
  count: {
    type: Number,
    default: 1,
  },
  status: {
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
});

applicationErrorSchema.index({ status: 1 });
applicationErrorSchema.index({ source: 1, message: 1 }, { unique: true });

const ApplicationError = mongoose.model('ApplicationError', applicationErrorSchema);

export default ApplicationError;