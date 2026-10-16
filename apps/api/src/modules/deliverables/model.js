import mongoose from 'mongoose';
import { DELIVERABLE_STATUSES, DELIVERABLE_TYPES } from '@mmp/shared';

const deliverableSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
      index: true,
    },
    contentItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContentItem',
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    type: {
      type: String,
      enum: DELIVERABLE_TYPES,
      default: 'video',
    },
    fileUrl: {
      type: String,
      trim: true,
    },
    externalLink: {
      type: String,
      trim: true,
    },
    thumbnail: {
      type: String,
      trim: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: DELIVERABLE_STATUSES,
      default: 'submitted',
      index: true,
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    decidedAt: {
      type: Date,
    },
    legacySubmissionId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
  },
  { timestamps: true }
);

deliverableSchema.index({ taskId: 1, version: -1 });
deliverableSchema.index({ contentItemId: 1, createdAt: -1 });

export const Deliverable = mongoose.model('Deliverable', deliverableSchema);
