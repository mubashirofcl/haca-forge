import mongoose from 'mongoose';
import { ROLE_KEYS } from '@mmp/shared';

const userSchema = new mongoose.Schema(
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
      enum: [...ROLE_KEYS, 'lead', 'viewer'],
      default: 'dept_staff',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
      index: true,
    },
    department: {
      type: String,
      trim: true,
      index: true,
    },
    teamId: {
      type: String,
      index: true,
    },
    skills: {
      type: [String],
      default: [],
    },
    capacity: {
      type: Number,
      default: 40,
    },
    attendance: {
      type: String,
      enum: ['present', 'on_leave'],
      default: 'present',
    },
    onLeave: {
      type: Boolean,
      default: false,
    },
    leaveDates: {
      start: Date,
      end: Date,
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

userSchema.virtual('team').get(function () {
  return this.teamId;
}).set(function (val) {
  this.teamId = val;
});

userSchema.virtual('weeklyCapacityHours').get(function () {
  return this.capacity || 40;
}).set(function (val) {
  this.capacity = val;
});

export const User = mongoose.model('User', userSchema);
