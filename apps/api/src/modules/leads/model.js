import mongoose from 'mongoose';
import { FUNNEL_STAGES } from '@mmp/shared';

const leadSchema = new mongoose.Schema(
  {
    lsqLeadId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      default: null,
      index: true,
    },
    leadSource: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    stage: {
      type: String,
      enum: FUNNEL_STAGES,
      default: 'Total Leads',
      required: true,
      index: true,
    },
    score: {
      type: Number,
      default: 0,
    },
    ownerEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: '',
    },
    ownerName: {
      type: String,
      default: '',
      trim: true,
    },
    contactName: {
      type: String,
      default: '',
      trim: true,
    },
    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: '',
    },
    contactPhone: {
      type: String,
      default: '',
      trim: true,
    },
    syncStatus: {
      type: String,
      enum: ['synced', 'discrepancy', 'unassigned'],
      default: 'synced',
      index: true,
    },
    discrepancyReason: {
      type: String,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      default: null,
    },
    rawData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

leadSchema.index({ profileId: 1, stage: 1 });
leadSchema.index({ syncStatus: 1, createdAt: -1 });
leadSchema.index({ leadSource: 1, createdAt: -1 });

export const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema);
