import mongoose from 'mongoose';
import { ACCESS_REQUEST_STATUSES, ROLE_KEYS } from '@mmp/shared';

const accessRequestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    requestedRole: {
      type: String,
      enum: [...ROLE_KEYS, 'lead', 'viewer'],
      required: true,
    },
    skills: {
      type: [String],
      default: [],
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ACCESS_REQUEST_STATUSES,
      default: 'pending',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    assignedRole: {
      type: String,
      enum: [...ROLE_KEYS, 'lead', 'viewer'],
    },
    assignedTeam: {
      type: String,
    },
    assignedCapacity: {
      type: Number,
    },
    rejectReason: {
      type: String,
    },
    inviteTokenHash: {
      type: String,
      select: false,
    },
    inviteExpiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

accessRequestSchema.index({ email: 1, status: 1 });

export const AccessRequest = mongoose.model('AccessRequest', accessRequestSchema);
