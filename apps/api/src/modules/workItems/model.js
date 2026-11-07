import mongoose from 'mongoose';
import '../people/model.js';
import '../calendar/plan.model.js';
import '../calendar/contentPiece.model.js';
import {
  CALENDAR_KEYS,
  WORK_TYPES,
  WORK_ITEM_STATUSES,
  PRIORITIES,
  BLOCKER_REASONS,
} from '@mmp/shared';

const workItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Work item title is required'],
      trim: true,
      maxlength: 300,
    },
    workType: {
      type: String,
      enum: WORK_TYPES,
      required: [true, 'Work type is required'],
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
      index: true,
    },
    recommendedOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
    },
    deadline: {
      type: Date,
      required: [true, 'Deadline is required'],
      index: true,
    },
    estimatedEffortHrs: {
      type: Number,
      default: 4,
      min: 0.5,
      max: 100,
    },
    status: {
      type: String,
      enum: WORK_ITEM_STATUSES,
      default: 'Not Started',
      index: true,
    },
    priority: {
      type: String,
      enum: PRIORITIES,
      default: 'Normal',
      index: true,
    },
    blockerReason: {
      type: String,
      enum: BLOCKER_REASONS,
      default: null,
    },
    blockerNote: {
      type: String,
      trim: true,
      default: '',
    },
    // Written by the poster when the Post step is marked posted (Phase 5d).
    postCaption: { type: String, default: '', trim: true },
    postHashtags: { type: String, default: '', trim: true },
    deliverableUrl: {
      type: String,
      trim: true,
      default: '',
    },
    publishedUrl: {
      type: String,
      trim: true,
      default: '',
    },
    revisions: {
      type: Number,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    // Content Flow stage fields (Phase 3 delta)
    contentPieceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContentPiece',
      default: null,
      index: true,
    },
    stageKey: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    stageOrder: {
      type: Number,
      default: null,
    },
    reviewRequired: {
      type: Boolean,
      default: false,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    unlockedAt: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    decisionAt: {
      type: Date,
      default: null,
    },
    changesRequestedAt: {
      type: Date,
      default: null,
    },
    resubmittedAt: {
      type: Date,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    postedAt: {
      type: Date,
      default: null,
    },
    // Interval logs for non-working states (Blocked, Pending)
    intervals: [
      {
        kind: {
          type: String,
          enum: ['blocked', 'pending'],
          required: true,
        },
        startedAt: {
          type: Date,
          required: true,
          default: Date.now,
        },
        endedAt: {
          type: Date,
          default: null,
        },
        reason: {
          type: String,
          default: '',
        },
        note: {
          type: String,
          default: '',
        },
      },
    ],
    // Revision rounds history for individual work time tracking
    rounds: [
      {
        roundNumber: {
          type: Number,
          required: true,
        },
        startedAt: {
          type: Date,
          required: true,
          default: Date.now,
        },
        submittedAt: {
          type: Date,
          default: null,
        },
        decisionAt: {
          type: Date,
          default: null,
        },
        decision: {
          type: String,
          enum: ['approved', 'changes_requested', null],
          default: null,
        },
        intervals: [
          {
            kind: {
              type: String,
              enum: ['blocked', 'pending'],
            },
            startedAt: Date,
            endedAt: Date,
            reason: String,
            note: String,
          },
        ],
      },
    ],
    isSkipped: {
      type: Boolean,
      default: false,
    },
    isLocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    calendar: {
      type: String,
      enum: CALENDAR_KEYS,
      default: 'sm',
      index: true,
    },
    calendarPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CalendarPlan',
      default: null,
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
      index: true,
    },
    dueDateSource: {
      type: String,
      enum: ['auto', 'manual', null],
      default: null,
    },
    // Deliverable link fields
    contentLink: {
      type: String,
      trim: true,
      default: '',
    },
    assetsLink: {
      type: String,
      trim: true,
      default: '',
    },
    // Brief specs with synchronized links
    brief: {
      description: {
        type: String,
        trim: true,
        default: '',
      },
      contentLink: {
        type: String,
        trim: true,
        default: '',
      },
      assetsLink: {
        type: String,
        trim: true,
        default: '',
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Keep brief and top-level fields (description, contentLink, assetsLink) in sync
workItemSchema.pre('validate', function (next) {
  if (!this.brief) {
    this.brief = {
      description: this.description || '',
      contentLink: this.contentLink || '',
      assetsLink: this.assetsLink || '',
    };
  } else {
    if (this.brief.description && !this.description) {
      this.description = this.brief.description;
    } else if (this.description && !this.brief.description) {
      this.brief.description = this.description;
    }
    if (this.brief.contentLink && !this.contentLink) {
      this.contentLink = this.brief.contentLink;
    } else if (this.contentLink && !this.brief.contentLink) {
      this.brief.contentLink = this.contentLink;
    }
    if (this.brief.assetsLink && !this.assetsLink) {
      this.assetsLink = this.brief.assetsLink;
    } else if (this.assetsLink && !this.brief.assetsLink) {
      this.brief.assetsLink = this.assetsLink;
    }
  }
  next();
});

// Dynamic computed property: isOverdue
// Overdue is NEVER a stored state. It is dynamically evaluated based on deadline and terminal status.
workItemSchema.virtual('isOverdue').get(function () {
  if (!this.deadline) return false;
  if (this.status === 'Approved' || this.status === 'Published') return false;
  return new Date(this.deadline) < new Date();
});

// Compound performance indexes
workItemSchema.index({ status: 1 });
workItemSchema.index({ ownerId: 1, status: 1 });
workItemSchema.index({ departmentId: 1, status: 1 });
workItemSchema.index({ deadline: 1, status: 1 });
workItemSchema.index({ isBlocked: 1 });
workItemSchema.index({ 'blocker.dependencyOwnerId': 1 });
workItemSchema.index({ workType: 1, status: 1 });
workItemSchema.index({ departmentId: 1, status: 1, deadline: 1 });
workItemSchema.index({ contentPieceId: 1, stageOrder: 1 });
workItemSchema.index({ contentPieceId: 1, stageKey: 1 });

export const WorkItem = mongoose.model('WorkItem', workItemSchema);
