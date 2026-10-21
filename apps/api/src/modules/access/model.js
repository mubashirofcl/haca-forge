import mongoose from 'mongoose';
import { ACCESS_REQUEST_STATUSES, ROLE_KEYS, REQUESTABLE_ROLES } from '@mmp/shared';

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
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },
    jobRole: {
      type: String,
      required: true,
      trim: true,
    },
    requestedRole: {
      type: String,
      enum: REQUESTABLE_ROLES,
      required: true,
      default: 'team_member',
    },
    requestedProfileCodes: {
      type: [String],
      default: [],
    },
    requestedProfileIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Profile',
      },
    ],
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ACCESS_REQUEST_STATUSES,
      default: 'pending',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
    },
    reviewedAt: {
      type: Date,
    },
    assignedRole: {
      type: String,
      enum: ROLE_KEYS,
    },
    assignedJobRole: {
      type: String,
      trim: true,
    },
    assignedDepartmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },
    assignedProfileAccess: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Profile',
      },
    ],
    assignedReportsToIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Person',
      },
    ],
    assignedCapacity: {
      type: Number,
      default: 40,
    },
    rejectReason: {
      type: String,
      trim: true,
    },
    infoQuestion: {
      type: String,
      trim: true,
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
accessRequestSchema.index({ status: 1, department: 1 });

export const AccessRequest =
  mongoose.models.AccessRequest || mongoose.model('AccessRequest', accessRequestSchema);
