import mongoose from 'mongoose';
import { SHOOT_STATUSES } from '@mmp/shared';

const shootSchema = new mongoose.Schema(
  {
    shootId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    crew: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    equipment: [
      {
        type: String,
        trim: true,
      },
    ],
    talentNotes: {
      type: String,
      trim: true,
    },
    contentItems: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ContentItem',
        required: true,
      },
    ],
    status: {
      type: String,
      enum: SHOOT_STATUSES,
      default: 'scheduled',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    reshootReason: {
      type: String,
      trim: true,
    },
    reshootCount: {
      type: Number,
      default: 0,
    },
    footageUrls: [
      {
        type: String,
        trim: true,
      },
    ],
    overrideWarning: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

shootSchema.index({ date: 1, status: 1 });
shootSchema.index({ crew: 1, date: 1 });

export const Shoot = mongoose.model('Shoot', shootSchema);
