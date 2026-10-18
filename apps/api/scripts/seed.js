import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/modules/users/model.js';
import { Department } from '../src/modules/departments/model.js';
import { logger } from '../src/lib/logger.js';

async function seed() {
  if (env.NODE_ENV === 'production') {
    logger.error('CRITICAL: Seeding is strictly forbidden in production environment!');
    process.exit(1);
  }

  await connectDB();
  logger.info('🌱 Starting clean database seed for HACA Marketing OS baseline...');

  try {
    const salt = await bcrypt.genSalt(10);
    const sharedPasswordHash = await bcrypt.hash('Password123!', salt);
    const adminPasswordHash = await bcrypt.hash(env.ADMIN_SEED_PASSWORD || 'Admin1212', salt);

    // Seed Admin if not exists
    const adminEmail = (env.ADMIN_SEED_EMAIL || 'admin@marketingportal.com').toLowerCase().trim();
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      await User.create({
        name: 'System Administrator',
        email: adminEmail,
        passwordHash: adminPasswordHash,
        role: 'admin',
        department: 'Tech',
        status: 'active',
        mustSetPassword: false,
      });
      logger.info(`✅ Seeded admin user: ${adminEmail}`);
    }

    // Ensure initial departments exist
    const defaultDepartments = [
      'Design',
      'Video Production',
      'Social Media',
      'SEO & Content',
      'WhatsApp',
      'Performance Marketing',
      'Tech',
    ];

    for (const name of defaultDepartments) {
      await Department.findOneAndUpdate(
        { name },
        { name, code: name.toLowerCase().replace(/[^a-z0-9]/g, '_') },
        { upsert: true, new: true }
      );
    }
    logger.info('✅ Initial departments verified');

    logger.info('🎉 Seed completed successfully!');
  } catch (error) {
    logger.error({ err: error }, 'Failed to seed database');
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

seed();
