import mongoose from 'mongoose';
import { TIME_ENTRY_STATUSES } from '@mmp/shared';

const timeEntrySchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    start: {
      type: Date,
    },
    end: {
      type: Date,
    },
    minutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    note: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: [...TIME_ENTRY_STATUSES, 'rejected'],
      default: 'draft',
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    rejectionComment: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

timeEntrySchema.index({ userId: 1, date: 1, status: 1 });
timeEntrySchema.index({ taskId: 1, status: 1 });

export const TimeEntry = mongoose.model('TimeEntry', timeEntrySchema);
