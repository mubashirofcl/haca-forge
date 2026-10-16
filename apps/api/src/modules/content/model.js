import mongoose from 'mongoose';
import { CONTENT_STATUSES, PRIORITY_LEVELS } from '@mmp/shared';

const contentItemSchema = new mongoose.Schema(
  {
    contentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    format: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    sourceDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      index: true,
    },
    calendarEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      index: true,
    },
    pillar: {
      type: String,
      trim: true,
      default: 'General',
    },
    platforms: [
      {
        type: String,
        trim: true,
      },
    ],
    publishDate: {
      type: Date,
      required: true,
      index: true,
    },
    productionDeadline: {
      type: Date,
      index: true,
    },
    reminderSentAt: {
      type: Date,
    },
    overdueAlertSentAt: {
      type: Date,
    },
    priority: {
      type: String,
      enum: PRIORITY_LEVELS,
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: CONTENT_STATUSES,
      default: 'planned',
      index: true,
    },
    caption: {
      type: String,
      trim: true,
    },
    hashtags: [
      {
        type: String,
        trim: true,
      },
    ],
    brief: {
      type: String,
      trim: true,
    },
    publishedUrl: {
      type: String,
      trim: true,
    },
    publishedAt: {
      type: Date,
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    metrics: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    requesterConfirmation: {
      status: {
        type: String,
        enum: ['not_required', 'pending', 'confirmed', 'changes_requested'],
        default: 'not_required',
      },
      confirmedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      confirmedAt: {
        type: Date,
      },
      feedback: {
        type: String,
        trim: true,
      },
      requestedAt: {
        type: Date,
      },
    },
    performanceStatus: {
      type: String,
      enum: ['none', 'handed_to_performance', 'live'],
      default: 'none',
    },
    liveUrl: {
      type: String,
      trim: true,
    },
    liveDate: {
      type: Date,
    },
    tasks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
      },
    ],
  },
  { timestamps: true }
);

// Compound indexes for high-frequency queries
contentItemSchema.index({ status: 1, publishDate: 1 });
contentItemSchema.index({ sourceDepartment: 1, status: 1 });
contentItemSchema.index({ format: 1, platform: 1 });
contentItemSchema.index({ campaignId: 1, status: 1 });

export const ContentItem = mongoose.model('ContentItem', contentItemSchema);
