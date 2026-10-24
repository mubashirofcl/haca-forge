import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Person } from '../src/modules/people/model.js';
import { seedReferenceData } from '../src/modules/referenceData/service.js';
import { logger } from '../src/lib/logger.js';

async function seed() {
  if (env.NODE_ENV === 'production') {
    logger.error('CRITICAL: Seeding is strictly forbidden in production environment!');
    process.exit(1);
  }

  await connectDB();
  logger.info('🌱 Starting clean database seed for HACA Marketing OS baseline (Phase 1)...');

  try {
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash(env.ADMIN_SEED_PASSWORD || 'Admin1212', salt);

    // 1. Seed Reference Data (7 Profiles and 7 Departments)
    const { profiles, departments } = await seedReferenceData();
    const allProfileIds = profiles.map((p) => p._id);
    const hacaProfile = profiles.find((p) => p.code === 'haca') || profiles[0];
    const techDept = departments.find((d) => d.code === 'tech') || departments[0];

    // 2. Seed Admin if not exists
    const adminEmail = (env.ADMIN_SEED_EMAIL || 'admin@marketingportal.com').toLowerCase().trim();
    const existingAdmin = await Person.findOne({ email: adminEmail });
    if (!existingAdmin) {
      await Person.create({
        name: 'System Administrator',
        email: adminEmail,
        passwordHash: adminPasswordHash,
        role: 'admin',
        departmentId: techDept?._id,
        profileAccess: allProfileIds,
        lastProfileId: hacaProfile?._id,
        status: 'active',
        mustSetPassword: false,
      });
      logger.info(`✅ Seeded admin user: ${adminEmail}`);
    } else {
      if (!existingAdmin.profileAccess || existingAdmin.profileAccess.length === 0) {
        existingAdmin.profileAccess = allProfileIds;
        existingAdmin.lastProfileId = hacaProfile?._id;
        await existingAdmin.save();
      }
      logger.info(`ℹ️ Admin user already exists: ${adminEmail}`);
    }

    logger.info('🎉 Seed completed successfully!');
  } catch (error) {
    logger.error({ err: error }, 'Failed to seed database');
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

seed();
