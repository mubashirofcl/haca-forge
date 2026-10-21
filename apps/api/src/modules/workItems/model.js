import mongoose from 'mongoose';
import '../people/model.js';
import {
  WORK_TYPES,
  WORK_ITEM_STATUSES,
  PRIORITIES,
  BLOCKER_REASONS,
} from '@mmp/shared';

const workItemSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: [true, 'Campaign linkage is strictly required'],
      index: true,
    },
    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      required: [true, 'Brand profile is required'],
      index: true,
    },
    relatedOKR: {
      type: String,
      required: [true, 'Related OKR is required'],
      trim: true,
    },
    relatedTarget: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MonthlyTarget',
      default: null,
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
      required: [true, 'Assigned owner is required'],
      index: true,
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

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
workItemSchema.index({ campaignId: 1, status: 1 });
workItemSchema.index({ deadline: 1, status: 1 });
workItemSchema.index({ profileId: 1, departmentId: 1, status: 1, deadline: 1 });

export const WorkItem = mongoose.model('WorkItem', workItemSchema);
