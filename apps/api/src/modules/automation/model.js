import mongoose from 'mongoose';
import { AUTOMATION_RULE_KEYS } from '@mmp/shared';

const automationRuleSchema = new mongoose.Schema(
  {
    ruleKey: {
      type: String,
      required: true,
      unique: true,
      enum: AUTOMATION_RULE_KEYS,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    trigger: {
      type: String,
      enum: ['cron', 'event', 'scheduled'],
      default: 'cron',
    },
    schedule: {
      type: String,
      required: true,
    },
    cronExpression: {
      type: String,
      default: null,
    },
    action: {
      type: String,
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastRunAt: {
      type: Date,
      default: null,
    },
    lastRunStatus: {
      type: String,
      enum: ['idle', 'success', 'failed', 'running'],
      default: 'idle',
    },
    lastRunSummary: {
      type: String,
      default: null,
    },
    lastRunDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

export const AutomationRule = mongoose.model('AutomationRule', automationRuleSchema);
