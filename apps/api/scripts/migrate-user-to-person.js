import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Person } from '../src/modules/people/model.js';
import { Profile } from '../src/modules/referenceData/profile.model.js';
import { Department } from '../src/modules/departments/model.js';
import { seedReferenceData } from '../src/modules/referenceData/service.js';
import { logger } from '../src/lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 10-key User to Person migration role mapping
const DEFAULT_ROLE_MAP = {
  admin: 'admin',
  head: 'marketing_head',
  lead: 'marketing_head',
  team_lead: 'team_lead',
  worker: 'team_member',
  sm_manager: 'team_member',
  management: 'suspended',
  dept_lead: 'suspended',
  dept_staff: 'suspended',
  viewer: 'suspended',
};

async function migrateUserToPerson() {
  await connectDB();
  logger.info('🚀 Starting Phase 1: User -> Person 10-Key Data Migration...');

  try {
    // 1. Ensure Reference Data (7 Profiles, 7 Departments) is seeded
    const { profiles, departments } = await seedReferenceData();
    const allProfileIds = profiles.map((p) => p._id);
    const hacaProfile = profiles.find((p) => p.code === 'haca') || profiles[0];

    // Department lookup by code and name
    const deptMap = new Map();
    departments.forEach((d) => {
      deptMap.set(d.code?.toLowerCase(), d._id);
      deptMap.set(d.name?.toLowerCase(), d._id);
    });

    // 2. Load migration overrides if file exists
    let overrides = {};
    const overridesPath = path.resolve(__dirname, 'migration-overrides.json');
    if (fs.existsSync(overridesPath)) {
      try {
        const raw = fs.readFileSync(overridesPath, 'utf8');
        overrides = JSON.parse(raw);
        logger.info(`Loaded ${Object.keys(overrides).length} migration overrides from ${overridesPath}`);
      } catch (e) {
        logger.warn({ err: e.message }, 'Failed to parse migration-overrides.json');
      }
    }

    // 3. Query all users from 'users' collection
    const usersCollection = mongoose.connection.db.collection('users');
    const teamAssignmentsCollection = mongoose.connection.db.collection('teamassignments');

    const allUsers = await usersCollection.find({}).toArray();
    logger.info(`Found ${allUsers.length} total users to process.`);

    const report = {
      total: allUsers.length,
      migrated: 0,
      roles: {
        admin: 0,
        marketing_head: 0,
        team_lead: 0,
        team_member: 0,
      },
      suspended: [],
      overridden: [],
    };

    for (const user of allUsers) {
      const email = (user.email || '').toLowerCase().trim();
      const currentRole = (user.role || '').toLowerCase().trim();

      // Determine target role and status
      let targetRole = DEFAULT_ROLE_MAP[currentRole] || 'team_member';
      let targetStatus = user.status || 'active';

      if (targetRole === 'suspended') {
        targetStatus = 'suspended';
        targetRole = 'team_member'; // Default base role while suspended
        report.suspended.push({ email, priorRole: currentRole, reason: 'Out-of-scope FORGE role retired in Marketing OS' });
      }

      // Check for explicit override
      if (overrides[email]) {
        const overrideRole = overrides[email];
        if (overrideRole === 'suspended') {
          targetStatus = 'suspended';
        } else {
          targetRole = overrideRole;
          targetStatus = 'active';
        }
        report.overridden.push({ email, priorRole: currentRole, newRole: overrideRole });
      }

      // 4. Convert active TeamAssignments into Person.reportsToIds[]
      let reportsToIds = user.reportsToIds || [];
      try {
        const activeAssignments = await teamAssignmentsCollection
          .find({
            $or: [{ workerId: user._id }, { workerId: user._id.toString() }],
            active: { $ne: false },
          })
          .toArray();

        if (activeAssignments.length > 0) {
          const leadIds = activeAssignments
            .map((ta) => ta.teamLeadId)
            .filter(Boolean)
            .map((id) => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id));

          reportsToIds = Array.from(new Set([...reportsToIds.map(String), ...leadIds.map(String)])).map(
            (id) => new mongoose.Types.ObjectId(id)
          );
        }
      } catch (err) {
        logger.warn({ err: err.message, user: email }, 'Error querying team assignments');
      }

      // 5. Map Department
      let departmentId = user.departmentId;
      if (!departmentId && user.department) {
        const depKey = user.department.toLowerCase();
        if (depKey.includes('design') || depKey.includes('graphics')) {
          departmentId = deptMap.get('design');
        } else if (depKey.includes('video') || depKey.includes('cinema') || depKey.includes('editor')) {
          departmentId = deptMap.get('video_production');
        } else if (depKey.includes('social')) {
          departmentId = deptMap.get('social_media');
        } else if (depKey.includes('seo') || depKey.includes('content')) {
          departmentId = deptMap.get('seo_content');
        } else if (depKey.includes('whatsapp')) {
          departmentId = deptMap.get('whatsapp');
        } else if (depKey.includes('perf')) {
          departmentId = deptMap.get('performance_marketing');
        } else if (depKey.includes('tech')) {
          departmentId = deptMap.get('tech');
        }
      }

      // 6. Map Job Role if not present
      let jobRole = user.jobRole;
      if (!jobRole) {
        if (currentRole === 'sm_manager') {
          jobRole = 'Social Media Manager';
        } else if (targetRole === 'team_lead') {
          jobRole = 'Creative Manager (TL)';
        } else if (currentRole === 'worker') {
          jobRole = 'Designer';
        }
      }

      // 7. Update in place
      const updateDoc = {
        $set: {
          role: targetRole,
          status: targetStatus,
          jobRole: jobRole || (targetRole === 'admin' ? '' : 'Designer'),
          departmentId: departmentId || null,
          profileAccess: user.profileAccess && user.profileAccess.length > 0 ? user.profileAccess : allProfileIds,
          reportsToIds,
          weeklyCapacityHours: user.weeklyCapacityHours || user.capacity || 40,
          lastProfileId: user.lastProfileId || hacaProfile?._id,
        },
      };

      await usersCollection.updateOne({ _id: user._id }, updateDoc);

      report.migrated++;
      if (targetStatus === 'active') {
        report.roles[targetRole] = (report.roles[targetRole] || 0) + 1;
      }
    }

    logger.info('========================================================');
    logger.info('📊 MIGRATION REPORT: User -> Person (10-Key Transformation)');
    logger.info('========================================================');
    logger.info(`Total records evaluated: ${report.total}`);
    logger.info(`Successfully migrated:    ${report.migrated}`);
    logger.info('Active counts by role:');
    logger.info(`  - admin:           ${report.roles.admin}`);
    logger.info(`  - marketing_head:  ${report.roles.marketing_head}`);
    logger.info(`  - team_lead:       ${report.roles.team_lead}`);
    logger.info(`  - team_member:     ${report.roles.team_member}`);
    logger.info(`Suspended legacy accounts: ${report.suspended.length}`);
    report.suspended.forEach((s) => logger.info(`    [SUSPENDED] ${s.email} (was: ${s.priorRole})`));
    if (report.overridden.length > 0) {
      logger.info(`Overrides applied: ${report.overridden.length}`);
      report.overridden.forEach((o) => logger.info(`    [OVERRIDE] ${o.email} -> ${o.newRole}`));
    }
    logger.info('========================================================');
    logger.info('✅ TeamAssignment collection preserved in MongoDB for archive/audit.');
    logger.info('🎉 Migration completed successfully!');
  } catch (error) {
    logger.error({ err: error }, 'Migration failed');
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

migrateUserToPerson();
