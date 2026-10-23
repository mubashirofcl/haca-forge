import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Person } from '../src/modules/people/model.js';
import { Profile } from '../src/modules/referenceData/profile.model.js';
import { Department } from '../src/modules/departments/model.js';
import { logger } from '../src/lib/logger.js';

// Operational collections to purge completely
const OPERATIONAL_COLLECTIONS = [
  'accessrequests',
  'activityevents',
  'assignment_overrides',
  'auditlogs',
  'blockers',
  'calendarentries',
  'campaigns',
  'comments',
  'contentitems',
  'deliverables',
  'feedbackentries',
  'leads',
  'leaverequests',
  'monthlytargets',
  'notifications',
  'requests',
  'revisionflags',
  'scheduledreports',
  'shoots',
  'statushistories',
  'tasks',
  'teamassignments',
  'timeentries',
  'workitems',
];

async function cleanDatabase() {
  await connectDB();
  logger.info('🧹 Starting Database Cleanup (Purging all non-admin data)...');

  try {
    const db = mongoose.connection.db;

    // 1. Locate or create the Admin user
    const adminEmail = (env.ADMIN_SEED_EMAIL || 'admin@hacaforge.com').toLowerCase().trim();
    let admin = await Person.findOne({
      $or: [{ role: 'admin' }, { email: adminEmail }],
    }).select('+passwordHash');

    // Fetch active profiles and departments for referencing
    const profiles = await Profile.find({ active: true }).lean();
    const allProfileIds = profiles.map((p) => p._id);
    const hacaProfile = profiles.find((p) => p.code === 'haca') || profiles[0];

    const techDept = await Department.findOne({
      $or: [{ code: 'tech' }, { name: 'Tech' }],
    }).lean();

    if (!admin) {
      logger.info(`Admin user not found. Creating default admin account: ${adminEmail}`);
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(env.ADMIN_SEED_PASSWORD || 'Admin1212', salt);

      admin = await Person.create({
        name: 'System Administrator',
        email: adminEmail,
        passwordHash,
        role: 'admin',
        departmentId: techDept?._id,
        profileAccess: allProfileIds,
        lastProfileId: hacaProfile?._id,
        status: 'active',
        mustSetPassword: false,
        reportsToIds: [],
        weeklyCapacityHours: 40,
      });
      logger.info(`✅ Created new Admin user with _id: ${admin._id}`);
    } else {
      // Ensure admin has full profile access, no dangling report lines, active status
      admin.role = 'admin';
      admin.status = 'active';
      admin.mustSetPassword = false;
      admin.reportsToIds = [];
      admin.profileAccess = allProfileIds;
      if (hacaProfile) admin.lastProfileId = hacaProfile._id;
      if (techDept) admin.departmentId = techDept._id;
      await admin.save();
      logger.info(`✅ Verified and retained Admin account: ${admin.email} (_id: ${admin._id})`);
    }

    // 2. Delete all other users from 'users'
    const userDeleteResult = await db.collection('users').deleteMany({
      _id: { $ne: admin._id },
    });
    logger.info(`🗑️ Deleted ${userDeleteResult.deletedCount} non-admin user account(s).`);

    // 3. Clear all operational / transactional collections
    const purgeStats = {};
    for (const colName of OPERATIONAL_COLLECTIONS) {
      const colExists = (await db.listCollections({ name: colName }).toArray()).length > 0;
      if (colExists) {
        const result = await db.collection(colName).deleteMany({});
        purgeStats[colName] = result.deletedCount;
      } else {
        purgeStats[colName] = 0;
      }
    }
    logger.info({ purgeStats }, '🗑️ Purged all operational / transactional collections');

    // 4. Reset team memberships and team leads
    const teamsExists = (await db.listCollections({ name: 'teams' }).toArray()).length > 0;
    if (teamsExists) {
      const teamResetResult = await db.collection('teams').updateMany(
        {},
        {
          $set: { members: [] },
          $unset: { lead: '' },
        }
      );
      logger.info(`🔄 Reset ${teamResetResult.modifiedCount} team(s): cleared members and leads.`);
    }

    // 5. Clean department leads (unset dangling user references)
    const deptExists = (await db.listCollections({ name: 'departments' }).toArray()).length > 0;
    if (deptExists) {
      const deptResetResult = await db.collection('departments').updateMany(
        {},
        {
          $unset: { lead: '' },
        }
      );
      logger.info(`🔄 Cleaned departments: unset legacy lead references.`);
    }

    // 6. Reset sequence counters to 0
    const countersExists = (await db.listCollections({ name: 'counters' }).toArray()).length > 0;
    if (countersExists) {
      await db.collection('counters').updateMany({}, { $set: { seq: 0 } });
      logger.info('🔄 Reset ID counters (seq: 0) for clean sequence numbering.');
    }

    // 7. Verify remaining database state
    const remainingUsers = await db.collection('users').find({}, { projection: { email: 1, role: 1 } }).toArray();
    logger.info(`Remaining users in DB: ${JSON.stringify(remainingUsers)}`);

    logger.info('✨ Database cleanup finished successfully! Only Admin and baseline reference configs remain.');
  } catch (err) {
    logger.error({ err }, '❌ Error during database cleanup');
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

cleanDatabase();
