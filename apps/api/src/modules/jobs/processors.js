import { logger } from '../../lib/logger.js';
import { executeAutomationRule } from '../automation/runner.js';

/**
 * BullMQ Job Processors for HACA Marketing OS
 * Executes Phase 7 Automation Rules and Report Generators with idempotency.
 */

export async function runOverdueEscalationJob(job) {
  logger.info({ jobId: job?.id }, '[BullMQ] Running Overdue Escalation Automation Rule');
  return executeAutomationRule('overdue_escalation', null);
}

export async function runTodoEscalationJob(job) {
  logger.info({ jobId: job?.id }, '[BullMQ] Running Stale Todo Escalation Automation Rule');
  return executeAutomationRule('todo_escalation', null);
}

export async function runBlockerAlertsJob(job) {
  logger.info({ jobId: job?.id }, '[BullMQ] Running Blocker Dependency Alerts Automation Rule');
  return executeAutomationRule('blocker_dependency_alert', null);
}

export async function runWeeklyReportJob(job) {
  logger.info({ jobId: job?.id }, '[BullMQ] Running Weekly Creative Report Automation Rule');
  return executeAutomationRule('weekly_report', null);
}

export async function runMonthEndReportJob(job) {
  logger.info({ jobId: job?.id }, '[BullMQ] Running Month-End Scorecard Automation Rule');
  return executeAutomationRule('month_end_report', null);
}

export async function runRevisionPatternFlagJob(job) {
  logger.info({ jobId: job?.id }, '[BullMQ] Running Revision Pattern Flag Automation Rule');
  return executeAutomationRule('revision_pattern_flag', null);
}

// Backward compatibility stubs for legacy queue registrations
export async function runDeadlineRemindersJob(job) {
  return runOverdueEscalationJob(job);
}

export async function runDailyDigestJob(job) {
  return runTodoEscalationJob(job);
}

export async function runRecurringRequestsJob(job) {
  return { processed: 0, status: 'retired' };
}

export async function runCapacityGapJob(job) {
  return { processed: 0, status: 'retired' };
}
