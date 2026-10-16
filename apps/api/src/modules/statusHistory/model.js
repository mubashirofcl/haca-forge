import mongoose from 'mongoose';
import { HOLD_REASON_CODES } from '@mmp/shared';

const statusHistorySchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ['Request', 'ContentItem', 'Task', 'Shoot', 'LeaveRequest', 'Deliverable'],
      required: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    fromStatus: {
      type: String,
      default: null,
    },
    toStatus: {
      type: String,
      required: true,
      index: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    reasonCode: {
      type: String,
      enum: [...HOLD_REASON_CODES, null],
      default: null,
    },
    comment: {
      type: String,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

statusHistorySchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
statusHistorySchema.index({ toStatus: 1, timestamp: -1 });
statusHistorySchema.index({ reasonCode: 1, timestamp: -1 });
statusHistorySchema.index({ entityType: 1, toStatus: 1, timestamp: -1 });

export const StatusHistory = mongoose.model('StatusHistory', statusHistorySchema);
