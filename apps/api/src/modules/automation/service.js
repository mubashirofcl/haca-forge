import { AutomationRule } from './model.js';
import { ensureAutomationRules, executeAutomationRule } from './runner.js';
import { ActivityEvent } from '../activity/model.js';
import { logger } from '../../lib/logger.js';

export async function listAutomationRules() {
  await ensureAutomationRules();
  return AutomationRule.find().sort({ createdAt: 1 }).lean();
}

export async function getAutomationRule(keyOrId) {
  await ensureAutomationRules();
  const query = keyOrId.match(/^[0-9a-fA-F]{24}$/)
    ? { _id: keyOrId }
    : { ruleKey: keyOrId };
  return AutomationRule.findOne(query).lean();
}

export async function toggleAutomationRule(id, active, user) {
  await ensureAutomationRules();
  const rule = await AutomationRule.findById(id);
  if (!rule) {
    throw new Error('Automation rule not found');
  }

  rule.active = active;
  await rule.save();

  try {
    if (user?._id) {
      await ActivityEvent.create({
        actorId: user._id,
        action: active ? 'automation.resumed' : 'automation.paused',
        entityType: 'automation_rule',
        entityId: rule.ruleKey,
        metadata: {
          active,
          ruleName: rule.name,
        },
      });
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to record ActivityEvent for automation toggle');
  }

  return rule;
}

export async function runAutomationRule(id, options = {}, user) {
  await ensureAutomationRules();
  const rule = await AutomationRule.findById(id);
  if (!rule) {
    throw new Error('Automation rule not found');
  }

  return executeAutomationRule(rule.ruleKey, user, { force: true, ...options });
}
