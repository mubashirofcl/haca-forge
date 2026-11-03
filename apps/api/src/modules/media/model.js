import mongoose from 'mongoose';
import { MEDIA_ITEM_STATUSES } from '@mmp/shared';

// ==========================================
// 1. MediaItem Schema (Clips & Assets)
// ==========================================

const mediaItemSchema = new mongoose.Schema(
  {
    stageItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkItem',
      required: true,
      index: true,
    },
    contentPieceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContentPiece',
      index: true,
      default: null,
    },
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      index: true,
      default: null,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      index: true,
      default: null,
    },
    kind: {
      type: String,
      enum: ['video', 'image'],
      default: 'video',
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    storageId: {
      type: String,
      default: '',
      trim: true,
    },
    thumbnailUrl: {
      type: String,
      default: '',
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    shotRef: {
      type: String,
      default: '',
      trim: true,
    },
    take: {
      type: Number,
      default: 1,
      min: 1,
    },
    tags: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
    favourite: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    replacesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MediaItem',
      default: null,
      index: true,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    width: {
      type: Number,
      default: 0,
      min: 0,
    },
    height: {
      type: Number,
      default: 0,
      min: 0,
    },
    orientationOk: {
      type: Boolean,
      default: true,
    },
    sizeBytes: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: MEDIA_ITEM_STATUSES,
      default: 'uploaded',
      index: true,
    },
    decidedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
    },
    decidedAt: {
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

mediaItemSchema.index({ stageItemId: 1, status: 1 });
mediaItemSchema.index({ stageItemId: 1, order: 1 });

export const MediaItem =
  mongoose.models.MediaItem || mongoose.model('MediaItem', mediaItemSchema);

// ==========================================
// 2. MediaMessage Schema (Clip-specific Chat Threads)
// ==========================================

const mediaMessageSchema = new mongoose.Schema(
  {
    mediaItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MediaItem',
      required: true,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      immutable: true, // Messages are immutable; edits are not allowed
    },
    timeSeconds: {
      type: Number,
      default: null,
      min: 0,
    },
    replyToId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MediaMessage',
      default: null,
    },
    seenBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Person',
          required: true,
        },
        seenAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    doneAt: {
      type: Date,
      default: null,
    },
    doneById: {
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

mediaMessageSchema.index({ mediaItemId: 1, createdAt: 1 });

export const MediaMessage =
  mongoose.models.MediaMessage || mongoose.model('MediaMessage', mediaMessageSchema);
