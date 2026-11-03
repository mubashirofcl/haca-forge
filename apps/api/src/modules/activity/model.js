import mongoose from 'mongoose';

const activityEventSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      index: true,
    },
    actingAs: {
      type: String,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    fromStatus: {
      type: String,
      trim: true,
    },
    toStatus: {
      type: String,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

activityEventSchema.index({ timestamp: -1 });
activityEventSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
activityEventSchema.index({ actorId: 1, timestamp: -1 });

export const ActivityEvent =

  mongoose.models.ActivityEvent || mongoose.model('ActivityEvent', activityEventSchema);
