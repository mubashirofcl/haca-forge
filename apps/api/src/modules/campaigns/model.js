import mongoose from 'mongoose';
import { CAMPAIGN_STATUSES, GOAL_TYPES, EXPECTED_OUTCOMES } from '@mmp/shared';

const campaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
      index: true,
    },
    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      required: [true, 'Profile / Brand linkage is required'],
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MonthlyTarget',
      required: [true, 'Monthly Target linkage is strictly required'],
      index: true,
    },
    relatedOKR: {
      type: String,
      required: [true, 'Related OKR is strictly required'],
      trim: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    status: {
      type: String,
      enum: CAMPAIGN_STATUSES,
      default: 'In Progress',
      index: true,
    },
    goalType: {
      type: String,
      enum: GOAL_TYPES,
      required: [true, 'Goal type is required'],
    },
    goalValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    expectedOutcome: {
      type: String,
      enum: EXPECTED_OUTCOMES,
      default: 'Lead Generation',
    },
    budget: {
      type: Number,
      default: 0,
      min: 0,
    },
    spend: {
      type: Number,
      default: 0,
      min: 0,
    },
    leadsActual: {
      type: Number,
      default: 0,
      min: 0,
    },
    qualifiedLeadsActual: {
      type: Number,
      default: 0,
      min: 0,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: [true, 'Campaign owner is required'],
      index: true,
    },
    progressPct: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

campaignSchema.virtual('budgetAllocated').get(function () {
  return this.budget;
}).set(function (val) {
  this.budget = val;
});

campaignSchema.virtual('spendActual').get(function () {
  return this.spend;
}).set(function (val) {
  this.spend = val;
});

export const Campaign =
  mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
