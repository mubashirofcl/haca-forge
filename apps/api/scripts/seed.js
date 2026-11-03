import { env } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { seedReferenceData } from '../src/modules/referenceData/service.js';
import { ensureBaselineUsers } from '../src/modules/people/baselineUsers.js';
import { logger } from '../src/lib/logger.js';

async function seed() {
  if (env.NODE_ENV === 'production') {
    logger.error('CRITICAL: Seeding is strictly forbidden in production environment!');
    process.exit(1);
  }

  await connectDB();
  logger.info('🌱 Starting clean database seed for HACA Marketing OS baseline (Phase 1)...');

  try {
    // 1. Seed Reference Data (Departments)
    await seedReferenceData();

    // 2. Seed Baseline Admin & Demo Quick-Fill Users
    await ensureBaselineUsers();

    logger.info('🎉 Seed completed successfully!');
  } catch (error) {
    logger.error({ err: error }, 'Failed to seed database');
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

seed();
