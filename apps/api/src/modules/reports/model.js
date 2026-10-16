import mongoose from 'mongoose';

const scheduledReportSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    reportType: {
      type: String,
      enum: ['department', 'team', 'individual', 'content', 'bottlenecks', 'scorecard'],
      required: true,
      index: true,
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly',
    },
    format: {
      type: String,
      enum: ['xlsx', 'csv', 'pdf'],
      default: 'xlsx',
    },
    recipients: [
      {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },
    ],
    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastSentAt: {
      type: Date,
    },
    nextRunAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

scheduledReportSchema.index({ isActive: 1, nextRunAt: 1 });

export const ScheduledReport = mongoose.model('ScheduledReport', scheduledReportSchema);
