import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { Person } from './model.js';
import { Department } from '../departments/model.js';
import { logger } from '../../lib/logger.js';

/**
 * Startup (Phase 9): only create the admin account when it is missing, from
 * ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD in the git-ignored .env. Existing users are never
 * rewritten and no password is ever reset here. The 12 local test users are created only by
 * scripts/reset-and-seed.js (passwords from SEED_PASSWORD_* in .env).
 */
export async function ensureBaselineUsers() {
  if (env.NODE_ENV === 'production') return { created: false, reason: 'production' };

  const email = (env.ADMIN_SEED_EMAIL || '').toLowerCase().trim();
  if (!email) {
    logger.warn('ADMIN_SEED_EMAIL is not set; skipping the admin account check');
    return { created: false, reason: 'no-email' };
  }
  if (await Person.exists({ email })) return { created: false, reason: 'exists' };

  if (!env.ADMIN_SEED_PASSWORD) {
    logger.warn(`Admin ${email} is missing and ADMIN_SEED_PASSWORD is not set; not creating it`);
    return { created: false, reason: 'no-password' };
  }
  const tech = await Department.findOne({ code: 'tech' }).select('_id').lean();
  await Person.create({
    name: 'System Administrator',
    email,
    passwordHash: await bcrypt.hash(env.ADMIN_SEED_PASSWORD, 10),
    role: 'admin',
    departmentId: tech?._id || null,
    weeklyCapacityHours: 40,
    status: 'active',
    mustSetPassword: false,
  });
  logger.info(`Created the missing admin account: ${email}`);
  return { created: true, reason: 'missing' };
}
