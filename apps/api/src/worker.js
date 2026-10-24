import { Worker } from 'bullmq';
import { connectDB } from './config/db.js';
import { logger } from './lib/logger.js';
import { sendMail } from './lib/mailer.js';
import {
  getRedisConnection,
  initQueues,
  isRedisReady,
  QUEUE_NAMES,
  scheduledJobsQueue,
} from './lib/queue.js';
import {
  runOverdueEscalationJob,
  runTodoEscalationJob,
  runBlockerAlertsJob,
  runRevisionPatternFlagJob,
  runWeeklyReportJob,
  runMonthEndReportJob,
} from './modules/jobs/processors.js';
import { fileURLToPath } from 'url';

let emailWorker = null;
let scheduledWorker = null;
let inMemoryIntervals = [];

export async function startWorker() {
  logger.info('🚀 Starting Marketing Portal Background Worker...');

  // 1. Connect to MongoDB
  await connectDB();

  // 2. Attempt Redis connection for BullMQ
  const queuesReady = await initQueues();

  if (queuesReady && isRedisReady()) {
    const connection = getRedisConnection();

    // Worker 1: Email Queue Worker
    emailWorker = new Worker(
      QUEUE_NAMES.EMAIL,
      async (job) => {
        logger.info({ jobId: job.id, to: job.data.to, subject: job.data.subject }, 'Processing email job');
        return sendMail(job.data);
      },
      { connection, concurrency: 5 }
    );

    emailWorker.on('completed', (job) => {
      logger.debug({ jobId: job.id }, 'Email job completed successfully');
    });

    emailWorker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, err: err.message }, 'Email job failed');
    });

    // Worker 2: Scheduled Jobs Worker
    scheduledWorker = new Worker(
      QUEUE_NAMES.SCHEDULED,
      async (job) => {
        logger.info({ jobName: job.name }, 'Executing scheduled background job');
        switch (job.name) {
          case 'overdue_escalation':
          case 'overdue-escalation':
          case 'deadline-reminders':
            return runOverdueEscalationJob(job);
          case 'todo_escalation':
          case 'todo-escalation':
          case 'daily-digest':
            return runTodoEscalationJob(job);
          case 'blocker_dependency_alert':
          case 'blocker-dependency-alert':
            return runBlockerAlertsJob(job);
          case 'revision_pattern_flag':
          case 'revision-pattern-flag':
            return runRevisionPatternFlagJob(job);
          case 'weekly_report':
          case 'weekly-report':
            return runWeeklyReportJob(job);
          case 'month_end_report':
          case 'month-end-report':
            return runMonthEndReportJob(job);
          default:
            logger.warn({ jobName: job.name }, 'Unknown scheduled job name');
        }
      },
      { connection, concurrency: 2 }
    );

    // Register repeatable jobs in BullMQ for all 6 Marketing OS automation rules
    if (scheduledJobsQueue) {
      // 1. Overdue escalation: every 15 minutes
      await scheduledJobsQueue.add(
        'overdue_escalation',
        {},
        {
          repeat: { pattern: '*/15 * * * *' },
          removeOnComplete: true,
        }
      );

      // 2. Stale todo escalation: every morning at 09:00
      await scheduledJobsQueue.add(
        'todo_escalation',
        {},
        {
          repeat: { pattern: '0 9 * * *' },
          removeOnComplete: true,
        }
      );

      // 3. Blocker dependency alerts: every morning at 10:00
      await scheduledJobsQueue.add(
        'blocker_dependency_alert',
        {},
        {
          repeat: { pattern: '0 10 * * *' },
          removeOnComplete: true,
        }
      );

      // 4. Revision pattern flag & audit: hourly
      await scheduledJobsQueue.add(
        'revision_pattern_flag',
        {},
        {
          repeat: { pattern: '0 * * * *' },
          removeOnComplete: true,
        }
      );

      // 5. Weekly marketing report: every Monday at 08:00
      await scheduledJobsQueue.add(
        'weekly_report',
        {},
        {
          repeat: { pattern: '0 8 * * 1' },
          removeOnComplete: true,
        }
      );

      // 6. Month-end performance scorecard: 23:59 on last day of month
      await scheduledJobsQueue.add(
        'month_end_report',
        {},
        {
          repeat: { pattern: '59 23 28-31 * *' },
          removeOnComplete: true,
        }
      );

      logger.info('BullMQ repeatable jobs registered for 6 automation rules');
    }
  } else {
    logger.info('Running in lightweight standalone worker mode (in-memory interval scheduler)');

    // In-memory intervals for local development without Redis
    // Run initial scan once at startup
    runOverdueEscalationJob().catch((err) => logger.warn({ err: err.message }, 'Initial overdue check warning'));
    runTodoEscalationJob().catch((err) => logger.warn({ err: err.message }, 'Initial todo check warning'));
    runBlockerAlertsJob().catch((err) => logger.warn({ err: err.message }, 'Initial blocker check warning'));
    runRevisionPatternFlagJob().catch((err) => logger.warn({ err: err.message }, 'Initial revision pattern check warning'));

    // Check overdue deliverables every 15 minutes
    const overdueInterval = setInterval(() => {
      runOverdueEscalationJob().catch((err) => logger.error({ err: err.message }, 'Overdue escalation error'));
    }, 15 * 60 * 1000);

    // Stale todo escalation check every 60 minutes
    const todoInterval = setInterval(() => {
      runTodoEscalationJob().catch((err) => logger.error({ err: err.message }, 'Todo escalation error'));
    }, 60 * 60 * 1000);

    // Blocker SLA check every 60 minutes
    const blockerInterval = setInterval(() => {
      runBlockerAlertsJob().catch((err) => logger.error({ err: err.message }, 'Blocker alert error'));
    }, 60 * 60 * 1000);

    // Revision pattern check every 60 minutes
    const revisionInterval = setInterval(() => {
      runRevisionPatternFlagJob().catch((err) => logger.error({ err: err.message }, 'Revision pattern error'));
    }, 60 * 60 * 1000);

    inMemoryIntervals.push(overdueInterval, todoInterval, blockerInterval, revisionInterval);
  }

  logger.info('✅ Marketing Portal Background Worker running and ready');
}

export async function stopWorker() {
  logger.info('Stopping background worker...');
  for (const interval of inMemoryIntervals) {
    clearInterval(interval);
  }
  inMemoryIntervals = [];

  if (emailWorker) await emailWorker.close();
  if (scheduledWorker) await scheduledWorker.close();
  logger.info('Background worker stopped cleanly');
}

// Auto-run if executed directly as entrypoint
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  startWorker().catch((err) => {
    logger.fatal({ err }, 'Worker fatal startup error');
    process.exit(1);
  });

  process.on('SIGTERM', async () => {
    await stopWorker();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await stopWorker();
    process.exit(0);
  });
}
