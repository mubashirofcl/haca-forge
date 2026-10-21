import mongoose from 'mongoose';
import { ROLE_KEYS, JOB_ROLES } from '@mmp/shared';

const personSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: ROLE_KEYS,
      default: 'team_member',
      required: true,
      index: true,
    },
    jobRole: {
      type: String,
      enum: [...JOB_ROLES, ''],
      trim: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      index: true,
    },
    profileAccess: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Profile',
        index: true,
      },
    ],
    reportsToIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Person',
        index: true,
      },
    ],
    weeklyCapacityHours: {
      type: Number,
      default: 40,
      min: 0,
      max: 168,
    },
    lastProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
    },
    status: {
      type: String,
      enum: ['invited', 'active', 'suspended'],
      default: 'active',
      index: true,
    },
    mustSetPassword: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    refreshTokenHash: {
      type: String,
      select: false,
    },
    resetPasswordTokenHash: {
      type: String,
      select: false,
    },
    resetPasswordExpiresAt: {
      type: Date,
    },
    skills: {
      type: [String],
      default: [],
    },
    notificationPreferences: {
      email: {
        requestUpdates: { type: Boolean, default: true },
        taskAssigned: { type: Boolean, default: true },
        taskBlocked: { type: Boolean, default: true },
        reviewDecisions: { type: Boolean, default: true },
        deadlineReminders: { type: Boolean, default: true },
        dailyDigest: { type: Boolean, default: true },
      },
      inApp: {
        requestUpdates: { type: Boolean, default: true },
        taskAssigned: { type: Boolean, default: true },
        taskBlocked: { type: Boolean, default: true },
        reviewDecisions: { type: Boolean, default: true },
        deadlineReminders: { type: Boolean, default: true },
        mentions: { type: Boolean, default: true },
      },
      dailyDigest: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

personSchema.virtual('capacity').get(function () {
  return this.weeklyCapacityHours || 40;
}).set(function (val) {
  this.weeklyCapacityHours = val;
});

personSchema.virtual('department').get(function () {
  return this.departmentId;
}).set(function (val) {
  this.departmentId = val;
});

// Primary Person model, pointing to 'users' collection to transform in-place
export const Person = mongoose.models.Person || mongoose.model('Person', personSchema, 'users');
export const User = Person;
