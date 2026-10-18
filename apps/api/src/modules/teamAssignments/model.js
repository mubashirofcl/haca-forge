import mongoose from 'mongoose';

const teamAssignmentSchema = new mongoose.Schema(
  {
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    teamLeadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
    },
    endReason: {
      type: String,
      enum: ['reassigned', 'lead_changed', 'role_changed', 'manual', 'other'],
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound unique partial index: a worker can only have one ACTIVE assignment to the same team lead
teamAssignmentSchema.index(
  { workerId: 1, teamLeadId: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true },
  }
);

// Query optimization indexes
teamAssignmentSchema.index({ teamLeadId: 1, active: 1 });
teamAssignmentSchema.index({ workerId: 1, active: 1 });

export const TeamAssignment = mongoose.model('TeamAssignment', teamAssignmentSchema);
