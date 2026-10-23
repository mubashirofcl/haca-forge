import mongoose from 'mongoose';
import { ROLE_KEYS, JOB_ROLES, normalizeRole, WORK_PREFERENCES } from '@mmp/shared';

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
      set: (val) => normalizeRole(val),
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
    workPreferences: {
      type: [String],
      enum: WORK_PREFERENCES,
      default: [],
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
  if (val === null || val === undefined) {
    this.departmentId = null;
  } else if (val instanceof mongoose.Types.ObjectId || (mongoose.Types.ObjectId.isValid(val) && /^[0-9a-fA-F]{24}$/.test(String(val)))) {
    this.departmentId = val;
  }
});

// Resilient role normalization hooks for legacy document preservation
personSchema.pre('validate', function (next) {
  if (this.role) {
    this.role = normalizeRole(this.role);
  }
  next();
});

personSchema.post('init', function () {
  if (this.role) {
    this.role = normalizeRole(this.role);
  }
});

// Primary Person model, pointing to 'users' collection to transform in-place
export const Person = mongoose.models.Person || mongoose.model('Person', personSchema, 'users');
export const User = Person;
