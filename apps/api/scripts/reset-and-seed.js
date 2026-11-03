import { env } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Department } from '../src/modules/departments/model.js';
import { Person } from '../src/modules/people/model.js';
import { seedReferenceData } from '../src/modules/referenceData/service.js';
import { ensureReportDefinitions } from '../src/modules/reports/service.js';
import { ensureAutomationRules } from '../src/modules/automation/runner.js';
import { DEMO_USERS_CONFIG } from '../src/modules/people/baselineUsers.js';
import { logger } from '../src/lib/logger.js';

async function resetAndSeed() {
  if (env.NODE_ENV === 'production') {
    logger.error('CRITICAL: Reset & Seed is strictly forbidden in production!');
    process.exit(1);
  }

  await connectDB();
  logger.info('🧹 Dropping all existing database collections in marketing_portal...');

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  for (const col of collections) {
    if (!col.name.startsWith('system.')) {
      await db.collection(col.name).drop();
      logger.info(`  Dropped collection: ${col.name}`);
    }
  }

  logger.info('🌱 Re-seeding canonical reference data (Departments)...');
  await seedReferenceData();

  logger.info('📊 Ensuring report definitions & automation rules...');
  await ensureReportDefinitions();
  await ensureAutomationRules();

  logger.info('👤 Seeding Admin & 12 Role Users...');
  const salt = await bcrypt.genSalt(10);
  const departments = await Department.find().lean();
  const getDeptId = (code) => {
    if (!code) return null;
    return (
      departments.find((d) => d.code === code)?._id ||
      departments.find((d) => d.name?.toLowerCase().includes(code.replace('_', ' ')))?._id ||
      departments[0]?._id
    );
  };

  // 1. Seed Admin
  const adminEmail = (env.ADMIN_SEED_EMAIL || 'admin@hacaforge.com').toLowerCase().trim();
  const adminPassword = env.ADMIN_SEED_PASSWORD || 'Admin1212';
  const adminPasswordHash = await bcrypt.hash(adminPassword, salt);
  const techDeptId = getDeptId('tech');

  const adminUser = await Person.create({
    name: 'System Administrator',
    email: adminEmail,
    phone: '9000000000',
    passwordHash: adminPasswordHash,
    role: 'admin',
    departmentId: techDeptId,
    weeklyCapacityHours: 40,
    status: 'active',
    mustSetPassword: false,
  });
  logger.info(`✅ Seeded Admin: ${adminUser.email}`);

  // 2. Seed 12 Users
  const seededUsers = [];
  for (const cfg of DEMO_USERS_CONFIG) {
    const email = cfg.email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(cfg.password, salt);
    const deptId = getDeptId(cfg.departmentCode);
    const capacity = cfg.capacity !== undefined ? cfg.capacity : (cfg.role === 'executive' ? 0 : 40);

    const user = await Person.create({
      name: cfg.name,
      email,
      phone: cfg.phone || '',
      passwordHash,
      role: cfg.role,
      jobRole: cfg.jobRole || '',
      departmentId: deptId,
      workPreferences: cfg.workPreferences || [],
      weeklyCapacityHours: capacity,
      status: 'active',
      mustSetPassword: false,
    });
    seededUsers.push(user);
    logger.info(`✅ Seeded user: ${user.name} (${user.email}) [${user.role}] - Phone: ${user.phone}`);
  }

  // 3. Create System Team Chat & Add All Users
  const Channel = mongoose.model(
    'Channel',
    new mongoose.Schema({}, { strict: false }),
    'channels'
  );
  const ChannelMember = mongoose.model(
    'ChannelMember',
    new mongoose.Schema({}, { strict: false }),
    'channelmembers'
  );

  const teamChannel = await Channel.create({
    type: 'team',
    name: 'Team Chat',
    description: 'System-wide team communication channel for all active members.',
    systemSlug: 'team-chat',
    isArchived: false,
    lastMessageAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const allActiveUsers = [adminUser, ...seededUsers];
  for (const u of allActiveUsers) {
    await ChannelMember.create({
      channelId: teamChannel._id,
      userId: u._id,
      role: u.role === 'admin' ? 'admin' : 'member',
      joinedAt: new Date(),
      isMuted: false,
    });
  }
  logger.info(`💬 Initialized Team Chat channel with ${allActiveUsers.length} members`);

  logger.info('\n🎉 Database reset & seed completed successfully!\n');
}

resetAndSeed()
  .then(() => disconnectDB())
  .catch((err) => {
    logger.error({ err }, 'Failed to reset and seed database');
    process.exit(1);
  });

