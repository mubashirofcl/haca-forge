import mongoose from 'mongoose';
import { LEAVE_TYPES, LEAVE_STATUSES } from '@mmp/shared';

const leaveRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: LEAVE_TYPES,
      default: 'vacation',
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: LEAVE_STATUSES,
      default: 'pending',
      index: true,
    },
    reviewComment: {
      type: String,
      trim: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

leaveRequestSchema.index({ userId: 1, startDate: 1, endDate: 1 });
leaveRequestSchema.index({ status: 1, startDate: 1, endDate: 1 });

export const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);
