import mongoose from 'mongoose';
import { TEAM_KEYS } from '@mmp/shared';

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: TEAM_KEYS,
      required: true,
      unique: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    defaultWeeklyCapacity: {
      type: Number,
      default: 40,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Team = mongoose.model('Team', teamSchema);
