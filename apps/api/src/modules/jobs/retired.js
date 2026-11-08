import { logger } from '../../lib/logger.js';

/**
 * Scheduled report emails were retired in Phase 7: reports are live pages only.
 * Their jobs may still arrive from repeat schedules saved in Redis before the change, and
 * their rule records stay in the database untouched. Such a job is logged and does nothing.
 */
export const RETIRED_JOB_NAMES = Object.freeze(['weekly_report', 'weekly-report', 'month_end_report', 'month-end-report']);

export const isRetiredJob = (name) => RETIRED_JOB_NAMES.includes(String(name || ''));

export async function runRetiredJob(name) {
  logger.info({ jobName: name }, 'Scheduled job retired: report emails were removed in Phase 7; nothing to do');
  return { status: 'retired', jobName: name, processed: 0 };
}

/**
 * Removes the retired jobs' repeat schedules from the BullMQ queue (queue state, not
 * business data). Other schedules are left alone. Returns how many were removed.
 */
export async function removeRetiredSchedules(queue) {
  if (!queue || typeof queue.getRepeatableJobs !== 'function') return 0;
  const repeatable = await queue.getRepeatableJobs();
  let removed = 0;
  for (const job of repeatable || []) {
    if (!isRetiredJob(job?.name)) continue;
    await queue.removeRepeatableByKey(job.key);
    removed += 1;
  }
  if (removed) logger.info({ removed }, 'Removed retired report schedules from the queue');
  return removed;
}
