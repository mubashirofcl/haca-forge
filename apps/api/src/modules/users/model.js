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
      enum: ROLE_KEYS,
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
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model('User', userSchema);
