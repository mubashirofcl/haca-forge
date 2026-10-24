import mongoose from 'mongoose';
import { ROW_STATUSES, WORK_TYPES } from '@mmp/shared';

const contentPieceSchema = new mongoose.Schema(
  {
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CalendarPlan',
      required: true,
      index: true,
    },
    postingDate: {
      type: Date,
      required: true,
      index: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    contentType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    needsScript: {
      type: Boolean,
      default: false,
    },
    needsShoot: {
      type: Boolean,
      default: false,
    },
    contentLink: {
      type: String,
      trim: true,
      default: '',
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    rowStatus: {
      type: String,
      enum: ROW_STATUSES,
      default: 'draft',
      index: true,
    },
    reviewComment: {
      type: String,
      trim: true,
      default: null,
    },
    pipeline: {
      type: String,
      enum: ['design', 'reel_a', 'reel_b', 'reel_c'],
      required: true,
      index: true,
    },
    hasPostStage: {
      type: Boolean,
      default: true,
    },
    stagesGenerated: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    liveUrl: {
      type: String,
      trim: true,
      default: '',
    },
    turnaroundDays: {
      type: Number,
      default: null,
    },
    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      default: null,
      index: true,
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

contentPieceSchema.index({ planId: 1, rowStatus: 1 });
contentPieceSchema.index({ postingDate: 1, contentType: 1 });

export const ContentPiece = mongoose.model('ContentPiece', contentPieceSchema);
export default ContentPiece;
