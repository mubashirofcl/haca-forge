import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { Person } from './model.js';
import { Department } from '../departments/model.js';
import { logger } from '../../lib/logger.js';

export const DEMO_USERS_CONFIG = [
  // USER 1
  {
    name: 'Test Creative Head',
    email: 'creativehead@demo.haca.local',
    phone: '9000000001',
    role: 'creative_head',
    jobRole: 'Creative Manager (TL)',
    departmentCode: 'design',
    workPreferences: [],
    capacity: 40,
    password: 'Head@Test101',
  },
  // USER 2
  {
    name: 'Test SM Manager',
    email: 'smmanager@demo.haca.local',
    phone: '9000000002',
    role: 'sm_manager',
    jobRole: 'Social Media Manager',
    departmentCode: 'social_media',
    workPreferences: [],
    capacity: 40,
    password: 'SMmgr@Test102',
  },
  // USER 3
  {
    name: 'Test Executive',
    email: 'executive@demo.haca.local',
    phone: '9000000003',
    role: 'executive',
    jobRole: '',
    departmentCode: null,
    workPreferences: [],
    capacity: 0,
    password: 'Exec@Test103',
  },
  // USER 4
  {
    name: 'Test Writer One',
    email: 'writer1@demo.haca.local',
    phone: '9000000011',
    role: 'team_member',
    jobRole: 'Writer',
    departmentCode: 'seo_content',
    workPreferences: ['Content', 'Script'],
    capacity: 40,
    password: 'Writer1@Test111',
  },
  // USER 5
  {
    name: 'Test Writer Two',
    email: 'writer2@demo.haca.local',
    phone: '9000000012',
    role: 'team_member',
    jobRole: 'Writer',
    departmentCode: 'seo_content',
    workPreferences: ['Content', 'Script'],
    capacity: 40,
    password: 'Writer2@Test112',
  },
  // USER 6
  {
    name: 'Test Designer One',
    email: 'designer1@demo.haca.local',
    phone: '9000000013',
    role: 'team_member',
    jobRole: 'Designer',
    departmentCode: 'design',
    workPreferences: ['Design'],
    capacity: 40,
    password: 'Design1@Test113',
  },
  // USER 7
  {
    name: 'Test Designer Two',
    email: 'designer2@demo.haca.local',
    phone: '9000000014',
    role: 'team_member',
    jobRole: 'UI Designer',
    departmentCode: 'design',
    workPreferences: ['Design'],
    capacity: 40,
    password: 'Design2@Test114',
  },
  // USER 8
  {
    name: 'Test Shooter',
    email: 'shooter@demo.haca.local',
    phone: '9000000015',
    role: 'team_member',
    jobRole: 'Video Editor',
    departmentCode: 'video_production',
    workPreferences: ['Shoot'],
    capacity: 40,
    password: 'Shoot1@Test115',
  },
  // USER 9
  {
    name: 'Test Editor One',
    email: 'editor1@demo.haca.local',
    phone: '9000000016',
    role: 'team_member',
    jobRole: 'Video Editor',
    departmentCode: 'video_production',
    workPreferences: ['Edit'],
    capacity: 40,
    password: 'Edit1@Test116',
  },
  // USER 10
  {
    name: 'Test Editor Two',
    email: 'editor2@demo.haca.local',
    phone: '9000000017',
    role: 'team_member',
    jobRole: 'Video Editor',
    departmentCode: 'video_production',
    workPreferences: ['Edit'],
    capacity: 10,
    password: 'Edit2@Test117',
  },
  // USER 11
  {
    name: 'Test Poster',
    email: 'poster@demo.haca.local',
    phone: '9000000018',
    role: 'team_member',
    jobRole: 'Social Specialist',
    departmentCode: 'social_media',
    workPreferences: ['Post'],
    capacity: 40,
    password: 'Post1@Test118',
  },
  // USER 12
  {
    name: 'Test All Rounder',
    email: 'allrounder@demo.haca.local',
    phone: '9000000019',
    role: 'team_member',
    jobRole: 'Social Specialist',
    departmentCode: 'social_media',
    workPreferences: ['Script', 'Shoot', 'Post'],
    capacity: 40,
    password: 'All1@Test119',
  },
];

export async function ensureBaselineUsers() {
  if (env.NODE_ENV === 'production') {
    return;
  }

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

  // 1. Ensure Admin User from env
  const adminEmail = (env.ADMIN_SEED_EMAIL || 'admin@hacaforge.com').toLowerCase().trim();
  const adminPassword = env.ADMIN_SEED_PASSWORD || 'Admin1212';
  const adminPasswordHash = await bcrypt.hash(adminPassword, salt);
  const techDeptId = getDeptId('tech');

  const existingAdmin = await Person.findOne({ email: adminEmail }).select('+passwordHash');
  if (!existingAdmin) {
    await Person.create({
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
    logger.info(`✅ Initialized baseline admin: ${adminEmail}`);
  } else {
    existingAdmin.name = 'System Administrator';
    existingAdmin.departmentId = techDeptId;
    existingAdmin.role = 'admin';
    existingAdmin.passwordHash = adminPasswordHash;
    existingAdmin.status = 'active';
    existingAdmin.mustSetPassword = false;
    await existingAdmin.save();
    logger.info(`🔄 Updated baseline admin credentials: ${adminEmail}`);
  }

  // 2. Ensure Demo Quick-Fill Accounts
  for (const cfg of DEMO_USERS_CONFIG) {
    const email = cfg.email.toLowerCase().trim();
    const existing = await Person.findOne({ email }).select('+passwordHash');
    const passwordHash = await bcrypt.hash(cfg.password, salt);
    const deptId = getDeptId(cfg.departmentCode);
    const capacity = cfg.capacity !== undefined ? cfg.capacity : (cfg.role === 'executive' ? 0 : 40);

    if (!existing) {
      await Person.create({
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
      logger.info(`✅ Initialized demo user: ${email} (${cfg.role})`);
    } else {
      existing.name = cfg.name;
      existing.phone = cfg.phone || '';
      existing.role = cfg.role;
      existing.jobRole = cfg.jobRole || '';
      existing.departmentId = deptId;
      existing.workPreferences = cfg.workPreferences || [];
      existing.weeklyCapacityHours = capacity;
      existing.passwordHash = passwordHash;
      existing.status = 'active';
      existing.mustSetPassword = false;
      await existing.save();
      logger.info(`🔄 Updated demo user credentials: ${email}`);
    }
  }
}

