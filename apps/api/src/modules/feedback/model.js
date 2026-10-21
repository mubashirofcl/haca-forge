import mongoose from 'mongoose';
import { FEEDBACK_ROUND_STATUSES, REVISION_ROOT_CAUSES } from '@mmp/shared';

// 1. FeedbackEntry Schema: Two-entry round structure
const feedbackEntrySchema = new mongoose.Schema(
  {
    workItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkItem',
      required: true,
      index: true,
    },
    round: {
      type: Number,
      required: true,
      min: 1,
    },
    fromPersonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      index: true,
    },
    roundStatus: {
      type: String,
      enum: FEEDBACK_ROUND_STATUSES,
      required: true,
      default: 'Revision Required',
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    isResponse: {
      type: Boolean,
      default: false,
      index: true,
    },
    attachments: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        fileType: { type: String },
        size: { type: Number },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

feedbackEntrySchema.index({ workItemId: 1, round: 1, isResponse: 1 });
feedbackEntrySchema.index({ workItemId: 1, createdAt: -1 });

export const FeedbackEntry =
  mongoose.models.FeedbackEntry || mongoose.model('FeedbackEntry', feedbackEntrySchema);

// 2. RevisionFlag Schema: Auto-flagging on high revisions with root-cause taxonomy
const revisionFlagSchema = new mongoose.Schema(
  {
    workItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkItem',
      required: true,
      unique: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      index: true,
    },
    revisionsCount: {
      type: Number,
      required: true,
    },
    baselineAvg: {
      type: Number,
      default: 1.0,
    },
    isFlagged: {
      type: Boolean,
      default: true,
      index: true,
    },
    flaggedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    rootCause: {
      type: String,
      enum: [...REVISION_ROOT_CAUSES, null],
      default: null,
      index: true,
    },
    rootCauseNotes: {
      type: String,
      default: '',
    },
    classifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
    },
    classifiedAt: {
      type: Date,
      default: null,
    },
    isEscalated: {
      type: Boolean,
      default: false,
      index: true,
    },
    escalatedAt: {
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

// Virtual to determine if flag has exceeded 48h unclassified window
revisionFlagSchema.virtual('isOver48HoursUnclassified').get(function () {
  if (this.rootCause) return false;
  if (!this.flaggedAt) return false;
  const elapsedMs = Date.now() - new Date(this.flaggedAt).getTime();
  return elapsedMs > 48 * 60 * 60 * 1000;
});

export const RevisionFlag =
  mongoose.models.RevisionFlag || mongoose.model('RevisionFlag', revisionFlagSchema);
