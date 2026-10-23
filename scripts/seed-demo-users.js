import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Resolve environment variables from apps/api/.env or root .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import models
import { Person } from '../apps/api/src/modules/people/model.js';
import { Profile } from '../apps/api/src/modules/referenceData/profile.model.js';
import { Department } from '../apps/api/src/modules/departments/model.js';
import { AccessRequest } from '../apps/api/src/modules/access/model.js';
import { seedReferenceData } from '../apps/api/src/modules/referenceData/service.js';
import { seedTargetsAndCampaigns } from '../apps/api/src/modules/targets/seed.js';

export async function seedDemoUsers(options = {}) {
  const isRemove = options.remove || process.argv.includes('--remove-demo');

  const mongoUri =
    process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal';

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }

  // Handle --remove-demo
  if (isRemove) {
    console.log('🧹 Removing all demo users and access requests (@demo.haca.local)...');
    const userRes = await Person.deleteMany({ email: /@demo\.haca\.local$/i });
    const reqRes = await AccessRequest.deleteMany({ email: /@demo\.haca\.local$/i });
    console.log(`✅ Removed ${userRes.deletedCount} demo user(s) and ${reqRes.deletedCount} demo access request(s).`);
    return { removedUsers: userRes.deletedCount, removedRequests: reqRes.deletedCount };
  }

  const demoPassword = process.env.DEMO_SEED_PASSWORD;
  if (!demoPassword) {
    throw new Error(
      'CRITICAL: DEMO_SEED_PASSWORD environment variable is required to seed demo users. Please configure DEMO_SEED_PASSWORD in your .env file.'
    );
  }

  console.log('🌱 Seeding Marketing OS demo users for every role...');

  // Ensure reference taxonomies (7 Profiles, 7 Departments) are seeded
  await seedReferenceData();

  const allProfiles = await Profile.find({});
  const allDepartments = await Department.find({});

  const profileMap = new Map(allProfiles.map((p) => [p.code, p._id]));
  const deptMap = new Map(allDepartments.map((d) => [d.name.toLowerCase(), d._id]));

  const getProfileIds = (codes) =>
    codes.map((c) => profileMap.get(c)).filter(Boolean);

  const getDeptId = (name) => deptMap.get(name.toLowerCase());

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(demoPassword, salt);

  // 1. Create Team Leads first so their _id can be referenced in reportsToIds
  const designLead = await Person.findOneAndUpdate(
    { email: 'lead.design@demo.haca.local' },
    {
      $set: {
        name: 'Demo Design Lead',
        email: 'lead.design@demo.haca.local',
        passwordHash,
        role: 'team_lead',
        jobRole: 'Design Lead (TL)',
        departmentId: getDeptId('Design'),
        profileAccess: getProfileIds(['haca_design_school', 'haca_design_school_en']),
        reportsToIds: [],
        weeklyCapacityHours: 40,
        workPreferences: ['Design'],
        status: 'active',
        mustSetPassword: false,
      },
    },
    { upsert: true, new: true }
  );

  const creativeManager = await Person.findOneAndUpdate(
    { email: 'manager.creative@demo.haca.local' },
    {
      $set: {
        name: 'Demo Creative Manager',
        email: 'manager.creative@demo.haca.local',
        passwordHash,
        role: 'team_lead',
        jobRole: 'Creative Manager (TL)',
        departmentId: getDeptId('Video Production'),
        profileAccess: getProfileIds(['haca', 'haca_design_school']),
        reportsToIds: [],
        weeklyCapacityHours: 40,
        workPreferences: ['Script', 'Shoot', 'Edit'],
        status: 'active',
        mustSetPassword: false,
      },
    },
    { upsert: true, new: true }
  );

  const smManager = await Person.findOneAndUpdate(
    { email: 'sm.manager@demo.haca.local' },
    {
      $set: {
        name: 'Demo SM Manager',
        email: 'sm.manager@demo.haca.local',
        passwordHash,
        role: 'team_lead',
        jobRole: 'Social Media Manager',
        departmentId: getDeptId('Social Media'),
        profileAccess: allProfiles.map((p) => p._id),
        reportsToIds: [],
        weeklyCapacityHours: 40,
        workPreferences: ['Post', 'Content'],
        status: 'active',
        mustSetPassword: false,
      },
    },
    { upsert: true, new: true }
  );

  // 2. Create Marketing Head
  const marketingHead = await Person.findOneAndUpdate(
    { email: 'head@demo.haca.local' },
    {
      $set: {
        name: 'Demo Marketing Head',
        email: 'head@demo.haca.local',
        passwordHash,
        role: 'marketing_head',
        jobRole: '',
        departmentId: null,
        profileAccess: allProfiles.map((p) => p._id),
        reportsToIds: [],
        weeklyCapacityHours: 40,
        workPreferences: ['Content', 'Script', 'Post'],
        status: 'active',
        mustSetPassword: false,
      },
    },
    { upsert: true, new: true }
  );

  // 2b. Create Executive (CEO / Business Head / Director)
  const executive = await Person.findOneAndUpdate(
    { email: 'executive@demo.haca.local' },
    {
      $set: {
        name: 'Demo Executive',
        email: 'executive@demo.haca.local',
        passwordHash,
        role: 'executive',
        jobRole: '',
        departmentId: null,
        profileAccess: allProfiles.map((p) => p._id),
        reportsToIds: [],
        weeklyCapacityHours: 40,
        workPreferences: [],
        status: 'active',
        mustSetPassword: false,
      },
    },
    { upsert: true, new: true }
  );

  // 3. Create Team Members
  const teamMembersData = [
    {
      name: 'Demo UI Designer',
      email: 'ui.designer@demo.haca.local',
      role: 'team_member',
      jobRole: 'UI Designer',
      department: 'Design',
      brandCodes: ['haca_design_school', 'haca_design_school_en'],
      reportsTo: [designLead._id, creativeManager._id],
      workPreferences: ['Design'],
    },
    {
      name: 'Demo Designer',
      email: 'designer@demo.haca.local',
      role: 'team_member',
      jobRole: 'Designer',
      department: 'Design',
      brandCodes: ['haca_design_school'],
      reportsTo: [designLead._id],
      workPreferences: ['Design'],
    },
    {
      name: 'Demo Video Editor',
      email: 'video.editor@demo.haca.local',
      role: 'team_member',
      jobRole: 'Video Editor',
      department: 'Video Production',
      brandCodes: ['haca', 'haca_design_school'],
      reportsTo: [creativeManager._id],
      workPreferences: ['Edit', 'Shoot'],
    },
    {
      name: 'Demo Writer',
      email: 'writer@demo.haca.local',
      role: 'team_member',
      jobRole: 'Writer',
      department: 'SEO & Content',
      brandCodes: ['haca', 'haca_design_school', 'haca_marketing_school'],
      reportsTo: [creativeManager._id],
      workPreferences: ['Content', 'Script'],
    },
    {
      name: 'Demo WhatsApp Marketer',
      email: 'whatsapp@demo.haca.local',
      role: 'team_member',
      jobRole: 'WhatsApp Marketer',
      department: 'WhatsApp',
      brandCodes: ['haca'],
      reportsTo: [creativeManager._id],
      workPreferences: ['Post', 'Content'],
    },
    {
      name: 'Demo Performance Marketer',
      email: 'performance@demo.haca.local',
      role: 'team_member',
      jobRole: 'Performance Marketer',
      department: 'Performance Marketing',
      brandCodes: ['haca', 'haca_mideast'],
      reportsTo: [creativeManager._id],
      workPreferences: ['Post'],
    },
  ];

  const seededMembers = [];
  for (const m of teamMembersData) {
    const member = await Person.findOneAndUpdate(
      { email: m.email },
      {
        $set: {
          name: m.name,
          email: m.email,
          passwordHash,
          role: m.role,
          jobRole: m.jobRole,
          departmentId: getDeptId(m.department),
          profileAccess: getProfileIds(m.brandCodes),
          reportsToIds: m.reportsTo,
          weeklyCapacityHours: 40,
          workPreferences: m.workPreferences || [],
          status: 'active',
          mustSetPassword: false,
        },
      },
      { upsert: true, new: true }
    );
    seededMembers.push(member);
  }

  // 4. Ensure an Admin exists; if no admin exists, create Demo Admin
  const activeAdmin = await Person.findOne({ role: 'admin', status: 'active' });
  let adminUser = activeAdmin;
  if (!activeAdmin) {
    const adminEmail = (process.env.ADMIN_SEED_EMAIL || 'admin@demo.haca.local').toLowerCase().trim();
    adminUser = await Person.findOneAndUpdate(
      { email: adminEmail },
      {
        $set: {
          name: 'Demo System Admin',
          email: adminEmail,
          passwordHash,
          role: 'admin',
          jobRole: '',
          departmentId: getDeptId('Tech'),
          profileAccess: allProfiles.map((p) => p._id),
          reportsToIds: [],
          weeklyCapacityHours: 40,
          status: 'active',
          mustSetPassword: false,
        },
      },
      { upsert: true, new: true }
    );
    console.log(`👑 Created Demo Admin: ${adminEmail}`);
  }

  // 5. Seed two sample pending AccessRequests
  const sampleRequests = [
    {
      name: 'Applicant Alex (Copywriter)',
      email: 'alex.applicant@demo.haca.local',
      phone: '+91 98765 43210',
      department: 'SEO & Content',
      departmentId: getDeptId('SEO & Content'),
      jobRole: 'Writer',
      requestedRole: 'team_member',
      requestedProfileCodes: ['haca', 'haca_marketing_school'],
      requestedProfileIds: getProfileIds(['haca', 'haca_marketing_school']),
      reason: 'Applying to write high-converting copy and content campaigns.',
      status: 'pending',
    },
    {
      name: 'Applicant Sarah (Lead Strategist)',
      email: 'sarah.applicant@demo.haca.local',
      phone: '+91 98765 43211',
      department: 'Performance Marketing',
      departmentId: getDeptId('Performance Marketing'),
      jobRole: 'Performance Marketer',
      requestedRole: 'team_lead',
      requestedProfileCodes: ['haca', 'haca_mideast'],
      requestedProfileIds: getProfileIds(['haca', 'haca_mideast']),
      reason: 'Applying to coordinate and oversee paid media campaigns across Meta and Google Ads.',
      status: 'pending',
    },
  ];

  for (const r of sampleRequests) {
    await AccessRequest.findOneAndUpdate(
      { email: r.email },
      { $set: r },
      { upsert: true, new: true }
    );
  }

  // 6. Seed Monthly Targets & Baseline Campaigns (Phase 2)
  await seedTargetsAndCampaigns();

  const allDemoUsers = [
    marketingHead,
    executive,
    designLead,
    creativeManager,
    smManager,
    ...seededMembers,
  ];

  console.log('\n================================================================');
  console.log('✅ Demo users seeded successfully (domain: @demo.haca.local):');
  console.log('================================================================');
  console.table(
    allDemoUsers.map((u) => ({
      Name: u.name,
      Role: u.role,
      'Job Role': u.jobRole || 'none',
      'Work Preferences': (u.workPreferences || []).join(', ') || 'none',
      'Reports To Count': u.reportsToIds?.length || 0,
      'Brand Access Count': u.profileAccess?.length || 0,
    }))
  );
  console.log('Sample pending access requests: 2 created (Alex, Sarah)');
  console.log('Note: Demo users can be removed anytime with `node scripts/seed-demo-users.js --remove-demo`\n');

  return {
    users: allDemoUsers,
    adminUser,
    sampleRequests,
  };
}

// Direct execution guard
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seedDemoUsers()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Failed to seed demo users:', err.message);
      await mongoose.disconnect();
      process.exit(1);
    });
}
