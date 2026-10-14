import mongoose from 'mongoose';
import { DEPARTMENT_TYPES, HOLD_REASON_CODES, DYNAMIC_FIELD_TYPES } from '@mmp/shared';

// 1. Platform (YouTube, Instagram, Facebook, LinkedIn, Other)
const platformSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Platform = mongoose.model('Platform', platformSchema);

// 2. Priority (Urgent, High, Medium, Low)
const prioritySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    level: {
      type: Number,
      required: true,
      unique: true,
    },
    color: {
      type: String,
      default: '#8CA4D2',
    },
    slaHours: {
      type: Number,
      default: 48,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Priority = mongoose.model('Priority', prioritySchema);

// 3. HoldReason (waiting_for_content, approval_delay, resource_shortage, etc.)
const holdReasonSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      enum: HOLD_REASON_CODES,
      required: true,
      unique: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const HoldReason = mongoose.model('HoldReason', holdReasonSchema);

// 4. ContentFormat (Static Post, Carousel, Reel/Video, Ad Creative, etc.)
const contentFormatSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    leadTimeDays: {
      type: Number,
      required: true,
      min: 1,
    },
    defaultPlatforms: [
      {
        type: String,
        trim: true,
      },
    ],
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const ContentFormat = mongoose.model('ContentFormat', contentFormatSchema);

// 5. Dynamic Field Definition Subdocument
const dynamicFieldSchema = new mongoose.Schema(
  {
    fieldKey: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: DYNAMIC_FIELD_TYPES,
      required: true,
    },
    required: {
      type: Boolean,
      default: false,
    },
    options: [
      {
        type: String,
        trim: true,
      },
    ],
    placeholder: {
      type: String,
      trim: true,
    },
    helperText: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

// 6. RequestType (per source department with dynamic field schema)
const requestTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    departmentType: {
      type: String,
      enum: DEPARTMENT_TYPES,
      required: true,
      index: true,
    },
    fieldSchema: [dynamicFieldSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

requestTypeSchema.index({ name: 1, departmentType: 1 }, { unique: true });

export const RequestType = mongoose.model('RequestType', requestTypeSchema);

// 7. System Settings
const settingsSchema = new mongoose.Schema(
  {
    efficiencyWeights: {
      onTime: { type: Number, default: 0.4 },
      firstPass: { type: Number, default: 0.3 },
      speedVsEstimate: { type: Number, default: 0.2 },
      volumeUtilization: { type: Number, default: 0.1 },
    },
    requestersCanSeeWorkerNames: {
      type: Boolean,
      default: false,
    },
    requireReasonForHold: {
      type: Boolean,
      default: true,
    },
    defaultWeeklyCapacityHours: {
      type: Number,
      default: 40,
    },
  },
  { timestamps: true }
);

export const Settings = mongoose.model('Settings', settingsSchema);
