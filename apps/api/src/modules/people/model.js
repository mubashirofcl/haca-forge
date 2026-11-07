import mongoose from 'mongoose';
import { ROLE_KEYS, JOB_ROLES, normalizeRole, WORK_PREFERENCES } from '@mmp/shared';
import { disconnectUserSockets } from '../../lib/socketHub.js';

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
    lastLoginAt: {
      type: Date,
      default: null,
    },
    avatarUrl: {
      type: String,
      default: null,
      trim: true,
    },
    avatarStorageId: {
      type: String,
      default: null,
      trim: true,
    },
    preferredName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 60,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    phoneVerifiedAt: {
      type: Date,
      default: null,
    },
    whatsappNumber: {
      type: String,
      default: '',
      trim: true,
    },
    languages: {
      type: [String],
      default: [],
    },
    about: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },
    preferences: {
      startPage: {
        type: String,
        enum: ['Home', 'My Work', 'Calendar'],
        default: 'Home',
      },
      dateFormat: {
        type: String,
        enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
        default: 'DD/MM/YYYY',
      },
      timeFormat: {
        type: String,
        enum: ['12h', '24h'],
        default: '12h',
      },
      weekStart: {
        type: String,
        enum: ['monday', 'sunday'],
        default: 'monday',
      },
    },
    notificationPrefs: {
      mySteps: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
      },
      approvalsRevisions: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
      },
      messagesComments: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
      },
      deadlinesOverdue: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
      },
      planUpdates: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
      },
      system: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
      },
    },
    profileCompletedAt: {
      type: Date,
      default: null,
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
  this.$locals.accessKey = `${this.role}|${this.status}`;
});

// A changed role or status ends the user's live sockets. A reconnect goes through the
// handshake again, which refuses a suspended user and joins the new role's room.
personSchema.pre('save', function (next) {
  this.$locals.resetSockets = !this.isNew && this.$locals.accessKey !== `${this.role}|${this.status}`;
  next();
});

personSchema.post('save', function (doc) {
  if (doc.$locals.resetSockets) disconnectUserSockets(doc._id);
  doc.$locals.accessKey = `${doc.role}|${doc.status}`;
  doc.$locals.resetSockets = false;
});

// Primary Person model, pointing to 'users' collection to transform in-place
export const Person = mongoose.models.Person || mongoose.model('Person', personSchema, 'users');
export const User = Person;
