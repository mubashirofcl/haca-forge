import mongoose from 'mongoose';
import '../people/model.js';
import '../calendar/plan.model.js';
import '../calendar/contentPiece.model.js';
import {
  WORK_TYPES,
  WORK_ITEM_STATUSES,
  PRIORITIES,
  BLOCKER_REASONS,
} from '@mmp/shared';

const workItemSchema = new mongoose.Schema(
  {
    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      required: [true, 'Brand profile is required'],
      index: true,
    },
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
      default: 'Medium',
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
    unlockedAt: {
      type: Date,
      default: null,
    },
    isSkipped: {
      type: Boolean,
      default: false,
    },
    isLocked: {
      type: Boolean,
      default: false,
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
workItemSchema.index({ profileId: 1, status: 1 });
workItemSchema.index({ ownerId: 1, status: 1 });
workItemSchema.index({ departmentId: 1, status: 1 });
workItemSchema.index({ deadline: 1, status: 1 });
workItemSchema.index({ isBlocked: 1 });
workItemSchema.index({ 'blocker.dependencyOwnerId': 1 });
workItemSchema.index({ workType: 1, status: 1 });
workItemSchema.index({ profileId: 1, departmentId: 1, status: 1, deadline: 1 });
workItemSchema.index({ contentPieceId: 1, stageOrder: 1 });
workItemSchema.index({ contentPieceId: 1, stageKey: 1 });

export const WorkItem = mongoose.model('WorkItem', workItemSchema);
