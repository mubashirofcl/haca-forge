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
  runDeadlineRemindersJob,
  runRecurringRequestsJob,
  runDailyDigestJob,
  runCapacityGapJob,
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
          case 'deadline-reminders':
            return runDeadlineRemindersJob();
          case 'recurring-requests':
            return runRecurringRequestsJob();
          case 'daily-digest':
            return runDailyDigestJob();
          case 'capacity-gap':
            return runCapacityGapJob();
          default:
            logger.warn({ jobName: job.name }, 'Unknown scheduled job name');
        }
      },
      { connection, concurrency: 2 }
    );

    // Register repeatable jobs in BullMQ
    if (scheduledJobsQueue) {
      // Deadline reminders: every 15 minutes
      await scheduledJobsQueue.add(
        'deadline-reminders',
        {},
        {
          repeat: { pattern: '*/15 * * * *' },
          removeOnComplete: true,
        }
      );

      // Recurring requests: every day at midnight (00:05)
      await scheduledJobsQueue.add(
        'recurring-requests',
        {},
        {
          repeat: { pattern: '5 0 * * *' },
          removeOnComplete: true,
        }
      );

      // Daily digest: every morning at 08:00
      await scheduledJobsQueue.add(
        'daily-digest',
        {},
        {
          repeat: { pattern: '0 8 * * *' },
          removeOnComplete: true,
        }
      );

      // Capacity gap alerts: every Monday at 07:00
      await scheduledJobsQueue.add(
        'capacity-gap',
        {},
        {
          repeat: { pattern: '0 7 * * 1' },
          removeOnComplete: true,
        }
      );

      logger.info('BullMQ repeatable jobs registered');
    }
  } else {
    logger.info('Running in lightweight standalone worker mode (in-memory interval scheduler)');

    // In-memory intervals for local development without Redis
    // Run initial scan once at startup
    runDeadlineRemindersJob().catch((err) => logger.warn({ err: err.message }, 'Initial deadline check warning'));
    runRecurringRequestsJob().catch((err) => logger.warn({ err: err.message }, 'Initial recurring request check warning'));

    // Check deadlines every 15 minutes
    const deadlineInterval = setInterval(() => {
      runDeadlineRemindersJob().catch((err) => logger.error({ err: err.message }, 'Deadline reminders error'));
    }, 15 * 60 * 1000);

    // Check recurring requests every 60 minutes
    const recurringInterval = setInterval(() => {
      runRecurringRequestsJob().catch((err) => logger.error({ err: err.message }, 'Recurring requests error'));
    }, 60 * 60 * 1000);

    inMemoryIntervals.push(deadlineInterval, recurringInterval);
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
