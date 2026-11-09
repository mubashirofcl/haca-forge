import mongoose from 'mongoose';
import { ROW_STATUSES, WORK_TYPES, CALENDAR_KEYS } from '@mmp/shared';

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
    postingTime: {
      type: String,
      trim: true,
      default: '18:00',
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
    calendar: {
      type: String,
      enum: CALENDAR_KEYS,
      default: 'sm',
      index: true,
    },
    programOrEvent: {
      type: String,
      trim: true,
      default: '',
    },
    brief: {
      type: String,
      trim: true,
      default: '',
    },
    referenceLink: {
      type: String,
      trim: true,
      default: '',
    },
    priority: {
      type: String,
      enum: ['Normal', 'Urgent', 'High', 'Medium', 'Low'],
      default: 'Normal',
    },
    postingOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
    },
    sourceVideoLink: {
      type: String,
      trim: true,
      default: '',
    },
    needsScript: {
      type: Boolean,
      default: false,
    },
    needsShoot: {
      type: Boolean,
      default: false,
    },
    // Static Post / Carousel Post: false = Design only. No default, so existing rows are not
    // rewritten; a missing value means With content.
    needsContent: {
      type: Boolean,
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
    stagePlan: [
      {
        stageKey: {
          type: String,
          enum: ['Content', 'Script', 'Design', 'Shoot', 'Edit', 'Post'],
          required: true,
        },
        ownerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Person',
          default: null,
        },
        dueDate: {
          type: Date,
          required: true,
        },
        ownerSource: {
          type: String,
          enum: ['suggested', 'manual'],
          default: 'suggested',
        },
        dueDateSource: {
          type: String,
          enum: ['auto', 'manual'],
          default: 'auto',
        },
        overrideReason: {
          type: String,
          default: '',
        },
      },
    ],
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

contentPieceSchema.virtual('type').get(function () {
  return this.contentType;
}).set(function (val) {
  this.contentType = val;
});

contentPieceSchema.index({ planId: 1, rowStatus: 1 });
contentPieceSchema.index({ postingDate: 1, contentType: 1 });

export const ContentPiece = mongoose.model('ContentPiece', contentPieceSchema);
export default ContentPiece;
