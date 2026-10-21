import {
  listAutomationRules,
  getAutomationRule,
  toggleAutomationRule,
  runAutomationRule,
} from './service.js';
import {
  automationRuleToggleSchema,
  automationRuleRunSchema,
} from '@mmp/shared';

export async function getAutomationRulesHandler(req, res, next) {
  try {
    const rules = await listAutomationRules();
    return res.status(200).json({ rules });
  } catch (err) {
    next(err);
  }
}

export async function getAutomationRuleHandler(req, res, next) {
  try {
    const rule = await getAutomationRule(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: { message: 'Rule not found' } });
    }
    return res.status(200).json({ rule });
  } catch (err) {
    next(err);
  }
}

export async function toggleAutomationRuleHandler(req, res, next) {
  try {
    const parsed = automationRuleToggleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: parsed.error.issues,
        },
      });
    }

    const rule = await toggleAutomationRule(req.params.id, parsed.data.active, req.user);
    return res.status(200).json({ rule });
  } catch (err) {
    next(err);
  }
}

export async function runAutomationRuleHandler(req, res, next) {
  try {
    const parsed = automationRuleRunSchema.safeParse(req.body || {});
    const options = parsed.success ? parsed.data : {};

    const result = await runAutomationRule(req.params.id, options, req.user);
    return res.status(200).json({ result });
  } catch (err) {
    next(err);
  }
}
