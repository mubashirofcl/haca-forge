import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/modules/users/model.js';
import { logger } from '../src/lib/logger.js';

async function seedAdmin() {
  await connectDB();

  try {
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      logger.info(`An administrator account already exists (${existingAdmin.email}). Refusing to overwrite.`);
      await disconnectDB();
      process.exit(0);
    }

    if (!env.ADMIN_SEED_EMAIL || !env.ADMIN_SEED_PASSWORD) {
      logger.error('ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be defined in .env');
      await disconnectDB();
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(env.ADMIN_SEED_PASSWORD, salt);

    const admin = await User.create({
      name: 'System Administrator',
      email: env.ADMIN_SEED_EMAIL.toLowerCase().trim(),
      passwordHash,
      role: 'admin',
      department: 'Marketing Leadership',
      status: 'active',
      mustSetPassword: false,
    });

    logger.info(`✅ Successfully seeded initial administrator account: ${admin.email}`);
  } catch (error) {
    logger.error({ err: error }, 'Failed to seed initial admin user');
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

seedAdmin();
