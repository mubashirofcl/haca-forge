import mongoose from 'mongoose';
import crypto from 'crypto';
import {
  STEP_OUTPUT_KINDS,
  STAGE_KEYS,
  RATING_TAGS,
  COMMENT_ANCHOR_TYPES,
} from '@mmp/shared';

// ==========================================
// 1. Submission Schema
// ==========================================

const submissionFileSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    size: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    mime: { type: String, default: '' },
    name: { type: String, default: '' },
  },
  { _id: true }
);

const submissionSchema = new mongoose.Schema(
  {
    workItemId: {
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
    stageKey: {
      type: String,
      enum: STAGE_KEYS,
      index: true,
    },
    version: {
      type: Number,
      required: true,
      default: 0, // 0 = draft, 1..N = immutable submission versions
      index: true,
    },
    kind: {
      type: String,
      enum: STEP_OUTPUT_KINDS,
      required: true,
      index: true,
    },
    document: {
      json: { type: mongoose.Schema.Types.Mixed, default: null },
      htmlSnapshot: { type: String, default: '' },
      metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    files: [submissionFileSchema],
    fileUrl: {
      type: String,
      default: '',
      trim: true,
    },
    linkUrl: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    submittedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      index: true,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'changes_requested'],
      default: 'draft',
      index: true,
    },
    reviewedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    versionToken: {
      type: String,
      default: () => crypto.randomUUID(),
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

submissionSchema.index({ workItemId: 1, version: 1 }, { unique: true });
submissionSchema.index({ contentPieceId: 1, stageKey: 1 });
submissionSchema.index({ status: 1, submittedAt: 1 });

export const Submission =
  mongoose.models.Submission || mongoose.model('Submission', submissionSchema);

// ==========================================
// 2. SubmissionComment Schema
// ==========================================

const commentAnchorSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: COMMENT_ANCHOR_TYPES,
      required: true,
    },
    range: {
      from: { type: Number },
      to: { type: Number },
      text: { type: String },
    },
    seconds: { type: Number },
    x: { type: Number },
    y: { type: Number },
    page: { type: Number },
  },
  { _id: false }
);

const submissionCommentSchema = new mongoose.Schema(
  {
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      required: true,
      index: true,
    },
    workItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkItem',
      required: true,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      index: true,
    },
    anchor: {
      type: commentAnchorSchema,
      default: null,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubmissionComment',
      default: null,
      index: true,
    },
    resolved: {
      type: Boolean,
      default: false,
      index: true,
    },
    resolvedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
    },
    resolvedAt: {
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

submissionCommentSchema.index({ submissionId: 1, createdAt: 1 });
submissionCommentSchema.index({ workItemId: 1, resolved: 1 });

submissionCommentSchema
  .virtual('content')
  .get(function () {
    return this.text;
  })
  .set(function (val) {
    this.text = val;
  });

export const SubmissionComment =
  mongoose.models.SubmissionComment ||
  mongoose.model('SubmissionComment', submissionCommentSchema);

// ==========================================
// 3. Rating Schema
// ==========================================

const ratingEditLogSchema = new mongoose.Schema(
  {
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
    },
    editedAt: {
      type: Date,
      default: Date.now,
    },
    oldScore: { type: Number },
    newScore: { type: Number },
    oldFeedback: { type: String },
    newFeedback: { type: String },
    oldTags: [{ type: String }],
    newTags: [{ type: String }],
    reason: { type: String, required: true },
  },
  { _id: false }
);

const ratingSchema = new mongoose.Schema(
  {
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      required: true,
      unique: true,
      index: true,
    },
    workItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkItem',
      required: true,
      index: true,
    },
    contentPieceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContentPiece',
      default: null,
      index: true,
    },
    stageKey: {
      type: String,
      enum: STAGE_KEYS,
      required: true,
      index: true,
    },
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      index: true,
    },
    raterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      index: true,
    },
    score: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    feedback: {
      type: String,
      default: '',
      trim: true,
    },
    tags: [
      {
        type: String,
        enum: RATING_TAGS,
      },
    ],
    seenAt: {
      type: Date,
      default: null,
      index: true,
    },
    editedLog: [ratingEditLogSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ratingSchema.index({ workerId: 1, createdAt: -1 });
ratingSchema.index({ raterId: 1, createdAt: -1 });
ratingSchema.index({ stageKey: 1, score: 1 });

export const Rating =
  mongoose.models.Rating || mongoose.model('Rating', ratingSchema);

// ==========================================
// 4. EditorLock Schema (Single-Editor Heartbeat Lock)
// ==========================================

const editorLockSchema = new mongoose.Schema(
  {
    workItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkItem',
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    lastHeartbeat: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

export const EditorLock =
  mongoose.models.EditorLock || mongoose.model('EditorLock', editorLockSchema);

