import mongoose from 'mongoose';

const pipelineStageSchema = new mongoose.Schema(
  {
    order: {
      type: Number,
      required: true,
    },
    stageKey: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    team: {
      type: String,
      enum: ['content', 'graphics', 'cinematography', 'editor', 'lead'],
      required: true,
    },
    type: {
      type: String,
      enum: ['work', 'review', 'handoff'],
      default: 'work',
    },
    defaultRole: {
      type: String,
      trim: true,
    },
    leadTimeShare: {
      type: Number,
      default: 0.25,
      min: 0,
      max: 1,
    },
    autoAssign: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const pipelineTemplateSchema = new mongoose.Schema(
  {
    format: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    defaultLeadTimeDays: {
      type: Number,
      default: 3,
      min: 1,
    },
    stages: [pipelineStageSchema],
  },
  { timestamps: true }
);

export const PipelineTemplate = mongoose.model('PipelineTemplate', pipelineTemplateSchema);
