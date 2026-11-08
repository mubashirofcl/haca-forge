import mongoose from 'mongoose';
import { BLOCKER_REASONS } from '@mmp/shared';

const blockerSchema = new mongoose.Schema(
  {
    workItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkItem',
      required: true,
      index: true,
    },
    blockedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: BLOCKER_REASONS,
      required: true,
      index: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    dependencyOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Resolved'],
      default: 'Active',
      index: true,
    },
    blockedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
    },
    // The step's status when it was blocked; resolving returns it there (Phase 6).
    statusBefore: {
      type: String,
      default: null,
    },
    resolutionNotes: {
      type: String,
      default: '',
      trim: true,
    },
    lastNotifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

blockerSchema.index({ workItemId: 1, status: 1 });
blockerSchema.index({ dependencyOwnerId: 1, status: 1 });

export const Blocker =
  mongoose.models.Blocker || mongoose.model('Blocker', blockerSchema);
