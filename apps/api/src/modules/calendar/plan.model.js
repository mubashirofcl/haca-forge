import mongoose from 'mongoose';
import { CALENDAR_PLAN_KINDS, CALENDAR_KEYS } from '@mmp/shared';

const calendarPlanSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    calendar: {
      type: String,
      enum: CALENDAR_KEYS,
      required: true,
      default: 'sm',
      index: true,
    },
    kind: {
      type: String,
      enum: CALENDAR_PLAN_KINDS,
      default: 'monthly',
      index: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      index: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    approvedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    comment: {
      type: String,
      trim: true,
      default: '',
    },
    rejectionConcern: {
      type: String,
      trim: true,
      default: '',
    },
    submissionWarnings: {
      type: Array,
      default: [],
    },
    status: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

calendarPlanSchema.index({ periodStart: 1, periodEnd: 1 });
calendarPlanSchema.index({ calendar: 1, periodStart: 1, periodEnd: 1 });

export const CalendarPlan = mongoose.model('CalendarPlan', calendarPlanSchema);
export default CalendarPlan;
