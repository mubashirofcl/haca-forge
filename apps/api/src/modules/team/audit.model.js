import mongoose from 'mongoose';

const personChangeAuditSchema = new mongoose.Schema(
  {
    personId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      index: true,
    },
    field: {
      type: String,
      required: true,
      enum: ['jobRole', 'departmentId', 'workPreferences', 'weeklyCapacityHours'],
    },
    oldValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

personChangeAuditSchema.index({ personId: 1, createdAt: -1 });

export const PersonChangeAudit =
  mongoose.models.PersonChangeAudit || mongoose.model('PersonChangeAudit', personChangeAuditSchema);

