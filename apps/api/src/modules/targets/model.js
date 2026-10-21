import mongoose from 'mongoose';

const monthlyTargetSchema = new mongoose.Schema(
  {
    month: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'],
      index: true,
    },
    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      default: null,
      index: true,
    },
    revenueTarget: {
      type: Number,
      default: 0,
      min: 0,
    },
    leadsTarget: {
      type: Number,
      default: 0,
      min: 0,
    },
    qualifiedLeadsTarget: {
      type: Number,
      default: 0,
      min: 0,
    },
    budget: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Ensure only one target per profile per month (null profileId = org-wide)
monthlyTargetSchema.index({ month: 1, profileId: 1 }, { unique: true });

export const MonthlyTarget =
  mongoose.models.MonthlyTarget || mongoose.model('MonthlyTarget', monthlyTargetSchema);
