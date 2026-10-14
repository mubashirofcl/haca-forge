import mongoose from 'mongoose';
import { REQUEST_STATUSES, PRIORITY_LEVELS } from '@mmp/shared';

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    name: { type: String, required: true },
    size: { type: Number },
    type: { type: String },
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const triageInfoSchema = new mongoose.Schema(
  {
    decision: {
      type: String,
      enum: ['accepted', 'rejected', 'needs_info', 'merged'],
    },
    reason: {
      type: String,
      trim: true,
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    decidedAt: {
      type: Date,
    },
  },
  { _id: false }
);

const recurringSchema = new mongoose.Schema(
  {
    isRecurring: {
      type: Boolean,
      default: false,
    },
    frequency: {
      type: String,
      enum: ['weekly', 'monthly'],
    },
    nextRunAt: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
  },
  { _id: false }
);

const requestSchema = new mongoose.Schema(
  {
    requestId: {
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
      index: 'text',
    },
    sourceDepartment: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requestType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RequestType',
      index: true,
    },
    requestTypeName: {
      type: String,
      required: true,
      trim: true,
    },
    dynamicFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    priority: {
      type: String,
      enum: PRIORITY_LEVELS,
      default: 'medium',
      index: true,
    },
    deadline: {
      type: Date,
      required: true,
    },
    attachments: [attachmentSchema],
    status: {
      type: String,
      enum: REQUEST_STATUSES,
      default: 'submitted',
      index: true,
    },
    triage: triageInfoSchema,
    mergedInto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
    },
    mergedRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Request',
      },
    ],
    linkedContentItemIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ContentItem',
      },
    ],
    recurring: recurringSchema,
    comments: [commentSchema],
  },
  {
    timestamps: true,
  }
);

requestSchema.index({ sourceDepartment: 1, status: 1 });
requestSchema.index({ requester: 1, status: 1 });
requestSchema.index({ deadline: 1 });
requestSchema.index({ createdAt: -1 });

export const Request = mongoose.model('Request', requestSchema);
