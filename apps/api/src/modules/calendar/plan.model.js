import mongoose from 'mongoose';
import { CALENDAR_PLAN_KINDS } from '@mmp/shared';

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
    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

calendarPlanSchema.index({ periodStart: 1, periodEnd: 1 });

export const CalendarPlan = mongoose.model('CalendarPlan', calendarPlanSchema);
export default CalendarPlan;
