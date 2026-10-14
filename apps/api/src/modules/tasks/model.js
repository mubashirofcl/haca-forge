import mongoose from 'mongoose';
import { TASK_STATUSES, TEAM_KEYS } from '@mmp/shared';

const subtaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

const taskSchema = new mongoose.Schema(
  {
    taskId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    contentItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContentItem',
      required: true,
      index: true,
    },
    stageKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    stageOrder: {
      type: Number,
      default: 1,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    team: {
      type: String,
      enum: [...TEAM_KEYS, 'lead'],
      required: true,
      index: true,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    collaborators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: 'assigned',
      index: true,
    },
    estimateHours: {
      type: Number,
      default: 2,
      min: 0,
    },
    actualHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    dependencies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
      },
    ],
    holdReason: {
      type: String,
      trim: true,
    },
    holdComment: {
      type: String,
      trim: true,
    },
    revisionCount: {
      type: Number,
      default: 0,
    },
    dueDate: {
      type: Date,
      index: true,
    },
    subtasks: [subtaskSchema],
  },
  { timestamps: true }
);

// Indexes for worker queues and dashboard filtering
taskSchema.index({ assignee: 1, status: 1 });
taskSchema.index({ team: 1, status: 1 });
taskSchema.index({ contentItemId: 1, stageOrder: 1 });

export const Task = mongoose.model('Task', taskSchema);
