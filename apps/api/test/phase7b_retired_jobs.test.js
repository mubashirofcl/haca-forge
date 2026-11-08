import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { AutomationRule } from '../src/modules/automation/model.js';
import { ensureAutomationRules, executeAutomationRule, DEFAULT_AUTOMATION_RULES } from '../src/modules/automation/runner.js';
import { runWeeklyReportJob, runMonthEndReportJob } from '../src/modules/jobs/processors.js';
import { removeRetiredSchedules, RETIRED_JOB_NAMES } from '../src/modules/jobs/retired.js';
import { Notification } from '../src/modules/notifications/model.js';
import { ActivityEvent } from '../src/modules/activity/model.js';
import { ReportDefinition } from '../src/modules/reports/model.js';

describe('Phase 7b: retired report jobs and rule records', () => {
  const salt = `p7b-${Date.now()}`;
  const customKey = `custom_rule_${salt}`;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await AutomationRule.collection.deleteMany({ ruleKey: customKey });
  });

  describe('retired jobs do nothing', () => {
    const counts = async () => ({
      notifications: await Notification.countDocuments({}),
      events: await ActivityEvent.countDocuments({}),
      definitions: JSON.stringify(await ReportDefinition.find({}).sort({ reportKey: 1 }).lean()),
      rules: JSON.stringify(await AutomationRule.find({ ruleKey: { $in: ['weekly_report', 'month_end_report'] } }).sort({ ruleKey: 1 }).lean()),
    });

    it('the job processors and the rule runner return "retired" and change nothing', async () => {
      const before = await counts();
      const results = [
        await runWeeklyReportJob({ name: 'weekly_report' }),
        await runMonthEndReportJob({ name: 'month_end_report' }),
        await runWeeklyReportJob(),
        await executeAutomationRule('weekly_report', null, { force: true }),
        await executeAutomationRule('month_end_report', null, { force: true }),
      ];
      expect(results.map((r) => r.status)).toEqual(['retired', 'retired', 'retired', 'retired', 'retired']);
      expect(await counts()).toEqual(before);
    });

    it('they are no longer default rules', () => {
      const keys = DEFAULT_AUTOMATION_RULES.map((r) => r.ruleKey);
      expect(keys).toEqual(['overdue_escalation', 'todo_escalation', 'blocker_dependency_alert', 'revision_pattern_flag']);
    });
  });

  describe('their repeat schedules are removed from the queue', () => {
    function fakeQueue(names) {
      const jobs = names.map((name, i) => ({ name, key: `${name}::${i}` }));
      return {
        removed: [],
        async getRepeatableJobs() {
          return jobs.filter((j) => !this.removed.includes(j.key));
        },
        async removeRepeatableByKey(key) {
          this.removed.push(key);
          return true;
        },
      };
    }

    it('removes only the retired schedules', async () => {
      const queue = fakeQueue(['overdue_escalation', 'weekly_report', 'todo_escalation', 'month_end_report', 'weekly-report', 'revision_pattern_flag']);
      expect(await removeRetiredSchedules(queue)).toBe(3);
      expect(queue.removed).toEqual(['weekly_report::1', 'month_end_report::3', 'weekly-report::4']);
      const left = (await queue.getRepeatableJobs()).map((j) => j.name);
      expect(left).toEqual(['overdue_escalation', 'todo_escalation', 'revision_pattern_flag']);
      expect(left.some((n) => RETIRED_JOB_NAMES.includes(n))).toBe(false);
    });

    it('is safe with no queue or nothing to remove', async () => {
      expect(await removeRetiredSchedules(null)).toBe(0);
      expect(await removeRetiredSchedules(fakeQueue(['overdue_escalation']))).toBe(0);
    });
  });

  describe('rule records are never deleted at startup', () => {
    it('keeps an unknown rule and the retired rules, and inserts missing defaults', async () => {
      // A record with a key the model no longer lists (as older data was), written raw.
      await AutomationRule.collection.insertOne({ ruleKey: customKey, name: 'Custom', description: 'x', trigger: 'scheduled', schedule: 'x', action: 'x', active: false });
      for (const key of ['weekly_report', 'month_end_report']) {
        await AutomationRule.collection.updateOne({ ruleKey: key }, { $setOnInsert: { ruleKey: key, name: key, description: 'retired', trigger: 'scheduled', schedule: 'x', action: 'x' } }, { upsert: true });
      }
      await AutomationRule.deleteOne({ ruleKey: 'todo_escalation' });
      const before = (await AutomationRule.collection.find({}).toArray()).map((r) => [String(r._id), JSON.stringify(r)]);
      await ensureAutomationRules();
      await ensureAutomationRules();
      const after = await AutomationRule.collection.find({}).toArray();
      const afterById = new Map(after.map((r) => [String(r._id), JSON.stringify(r)]));
      // Every record that existed is still there, unchanged; only missing defaults were added.
      for (const [id, doc] of before) expect(afterById.get(id)).toBe(doc);
      const keys = after.map((r) => r.ruleKey);
      for (const key of DEFAULT_AUTOMATION_RULES.map((r) => r.ruleKey)) expect(keys.filter((k) => k === key)).toHaveLength(1);
      expect(await AutomationRule.collection.findOne({ ruleKey: customKey })).toBeTruthy();
      expect(await AutomationRule.exists({ ruleKey: 'weekly_report' })).toBeTruthy();
      expect(await AutomationRule.exists({ ruleKey: 'month_end_report' })).toBeTruthy();
      expect(await AutomationRule.exists({ ruleKey: 'todo_escalation' })).toBeTruthy();
      expect((await AutomationRule.collection.findOne({ ruleKey: customKey })).active).toBe(false);
    });
  });
});
