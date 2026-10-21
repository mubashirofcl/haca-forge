import mongoose from 'mongoose';

const assignmentOverrideSchema = new mongoose.Schema(
  {
    workItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkItem',
      required: true,
      index: true,
    },
    recommendedPersonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      index: true,
    },
    chosenPersonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      index: true,
    },
    overriddenById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

assignmentOverrideSchema.index({ workItemId: 1, createdAt: -1 });
assignmentOverrideSchema.index({ recommendedPersonId: 1, createdAt: -1 });
assignmentOverrideSchema.index({ chosenPersonId: 1, createdAt: -1 });

export const AssignmentOverride =
  mongoose.models.AssignmentOverride ||
  mongoose.model('AssignmentOverride', assignmentOverrideSchema, 'assignment_overrides');
