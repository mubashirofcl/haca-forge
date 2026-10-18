import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment config from apps/api/.env or root .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { User } from '../apps/api/src/modules/users/model.js';
import { AccessRequest } from '../apps/api/src/modules/access/model.js';
import { TeamAssignment } from '../apps/api/src/modules/teamAssignments/model.js';
import { AuditLog } from '../apps/api/src/modules/audit/model.js';

export async function runRolesV2Migration({ dryRun = false, rollback = false } = {}) {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established. Please connect before running migration.');
  }

  const report = {
    mode: dryRun ? 'DRY_RUN' : rollback ? 'ROLLBACK' : 'MIGRATE',
    timestamp: new Date().toISOString(),
    preflightCounts: {},
    usersMigrated: 0,
    accessRequestsMigrated: 0,
    teamAssignmentsCreated: 0,
    teamAssignmentsRemoved: 0,
    auditLogsCreated: 0,
    warnings: [],
    backupCollection: null,
    restoredFromBackup: null,
  };

  // Pre-flight check: dump counts of users by role
  const userAggregation = await User.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } },
  ]);
  for (const item of userAggregation) {
    report.preflightCounts[item._id || 'unknown'] = item.count;
  }

  console.log('--- Roles v2 Migration Pre-flight User Role Counts ---');
  console.table(report.preflightCounts);

  // ==========================================
  // ROLLBACK BRANCH
  // ==========================================
  if (rollback) {
    console.log('Initiating Rollback mode...');

    // 1. Find latest backup collection
    const collections = await db.listCollections().toArray();
    const backupCollections = collections
      .map((c) => c.name)
      .filter((name) => name.startsWith('_backup_users_roles_v1_'))
      .sort()
      .reverse();

    if (backupCollections.length === 0) {
      throw new Error('Rollback failed: No backup collection matching _backup_users_roles_v1_* found.');
    }

    const latestBackup = backupCollections[0];
    report.restoredFromBackup = latestBackup;
    console.log(`Found latest backup collection: ${latestBackup}`);

    if (dryRun) {
      const backupCount = await db.collection(latestBackup).countDocuments();
      console.log(`[DRY-RUN] Would restore ${backupCount} users from ${latestBackup}`);
      console.log(`[DRY-RUN] Would delete initial TeamAssignments created by Roles v2 migration`);
      console.log(`[DRY-RUN] Would revert AccessRequests (head -> lead, management -> viewer)`);
      return report;
    }

    // 2. Restore Users from backup collection
    const backupDocs = await db.collection(latestBackup).find({}).toArray();
    if (backupDocs.length > 0) {
      const bulkOps = backupDocs.map((doc) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      }));
      await db.collection('users').bulkWrite(bulkOps);
      report.usersMigrated = backupDocs.length;
      console.log(`Successfully restored ${backupDocs.length} users from ${latestBackup}.`);
    }

    // 3. Remove created TeamAssignments from migration
    const deleteAssignmentsRes = await TeamAssignment.deleteMany({
      notes: 'Initial backfill from Roles v2 migration',
    });
    report.teamAssignmentsRemoved = deleteAssignmentsRes.deletedCount;
    console.log(`Removed ${deleteAssignmentsRes.deletedCount} backfilled TeamAssignments.`);

    // 4. Revert AccessRequests
    const arRevertHead = await AccessRequest.updateMany(
      { requestedRole: 'head' },
      { $set: { requestedRole: 'lead' } }
    );
    const arRevertMgmt = await AccessRequest.updateMany(
      { requestedRole: 'management' },
      { $set: { requestedRole: 'viewer' } }
    );
    const arRevertAssignedHead = await AccessRequest.updateMany(
      { assignedRole: 'head' },
      { $set: { assignedRole: 'lead' } }
    );
    const arRevertAssignedMgmt = await AccessRequest.updateMany(
      { assignedRole: 'management' },
      { $set: { assignedRole: 'viewer' } }
    );
    report.accessRequestsMigrated =
      arRevertHead.modifiedCount +
      arRevertMgmt.modifiedCount +
      arRevertAssignedHead.modifiedCount +
      arRevertAssignedMgmt.modifiedCount;

    // 5. Audit Log Entry for Rollback
    const adminUser = await User.findOne({ role: 'admin' });
    await AuditLog.create({
      actor: adminUser?._id,
      actorEmail: adminUser?.email || 'admin@system.local',
      action: 'user.role.rollback',
      entity: 'System',
      entityId: latestBackup,
      before: { backup: latestBackup },
      after: { restoredUsersCount: backupDocs.length },
      timestamp: new Date(),
    });

    console.log('Rollback completed successfully.');
    return report;
  }

  // ==========================================
  // FORWARD MIGRATION BRANCH
  // ==========================================

  // Step 1: Find users to migrate
  const usersToMigrate = await User.find({
    role: { $in: ['lead', 'viewer'] },
  });

  console.log(`Found ${usersToMigrate.length} users with legacy roles (lead, viewer).`);

  // Step 0: Backup Users Collection (only when there are legacy users to migrate)
  if (usersToMigrate.length > 0) {
    const backupCollectionName = `_backup_users_roles_v1_${Date.now()}`;
    report.backupCollection = backupCollectionName;

    if (!dryRun) {
      const allUsers = await db.collection('users').find({}).toArray();
      await db.collection(backupCollectionName).insertMany(allUsers);
      console.log(`Created backup collection: ${backupCollectionName} (${allUsers.length} documents)`);
    } else {
      console.log(`[DRY-RUN] Would create backup collection: ${backupCollectionName}`);
    }
  }

  const adminUser = await User.findOne({ role: 'admin' });

  for (const user of usersToMigrate) {
    const fromRole = user.role;
    const toRole = fromRole === 'lead' ? 'head' : fromRole === 'viewer' ? 'management' : fromRole;

    if (dryRun) {
      console.log(`[DRY-RUN] Would migrate user ${user.email}: ${fromRole} -> ${toRole}`);
    } else {
      user.role = toRole;
      user.refreshTokenHash = null; // force re-login for updated tokens
      await user.save();

      await AuditLog.create({
        actor: adminUser?._id || user._id,
        actorEmail: adminUser?.email || 'migration@system.local',
        action: 'user.role.migrated',
        entity: 'User',
        entityId: user._id.toString(),
        before: { role: fromRole },
        after: { role: toRole, script: 'migrate-roles-v2' },
        timestamp: new Date(),
      });
      report.auditLogsCreated++;
    }
    report.usersMigrated++;
  }

  // Step 2: AccessRequests collection
  const arRequestedLead = await AccessRequest.find({ requestedRole: 'lead' });
  const arRequestedViewer = await AccessRequest.find({ requestedRole: 'viewer' });
  const arAssignedLead = await AccessRequest.find({ assignedRole: 'lead' });
  const arAssignedViewer = await AccessRequest.find({ assignedRole: 'viewer' });

  const totalAccessRequests =
    arRequestedLead.length +
    arRequestedViewer.length +
    arAssignedLead.length +
    arAssignedViewer.length;

  if (dryRun) {
    console.log(`[DRY-RUN] Would migrate ${totalAccessRequests} access request role references.`);
    report.accessRequestsMigrated = totalAccessRequests;
  } else {
    const u1 = await AccessRequest.updateMany({ requestedRole: 'lead' }, { $set: { requestedRole: 'head' } });
    const u2 = await AccessRequest.updateMany({ requestedRole: 'viewer' }, { $set: { requestedRole: 'management' } });
    const u3 = await AccessRequest.updateMany({ assignedRole: 'lead' }, { $set: { assignedRole: 'head' } });
    const u4 = await AccessRequest.updateMany({ assignedRole: 'viewer' }, { $set: { assignedRole: 'management' } });
    report.accessRequestsMigrated = u1.modifiedCount + u2.modifiedCount + u3.modifiedCount + u4.modifiedCount;
    console.log(`Migrated ${report.accessRequestsMigrated} access request documents.`);
  }

  // Step 3: Backfill initial TeamAssignments
  const teamLeads = await User.find({ role: 'team_lead', status: 'active' });
  const workers = await User.find({ role: 'worker', status: 'active' });

  // Check workers without a team
  for (const worker of workers) {
    const workerTeam = worker.teamId || worker.team;
    if (!workerTeam) {
      const warningMsg = `Worker ${worker.email} (${worker._id}) has no teamId assigned.`;
      console.warn(`⚠️ Warning: ${warningMsg}`);
      report.warnings.push(warningMsg);
    }
  }

  // Map teamLeads by team
  const leadsByTeam = new Map();
  for (const lead of teamLeads) {
    const leadTeam = lead.teamId || lead.team;
    if (!leadTeam) {
      const warningMsg = `Team lead ${lead.email} (${lead._id}) has no teamId assigned.`;
      console.warn(`⚠️ Warning: ${warningMsg}`);
      report.warnings.push(warningMsg);
      continue;
    }
    if (!leadsByTeam.has(leadTeam)) {
      leadsByTeam.set(leadTeam, []);
    }
    leadsByTeam.get(leadTeam).push(lead);
  }

  // Check teams with workers but no lead
  const uniqueWorkerTeams = new Set(workers.map((w) => w.teamId || w.team).filter(Boolean));
  for (const teamKey of uniqueWorkerTeams) {
    if (!leadsByTeam.has(teamKey) || leadsByTeam.get(teamKey).length === 0) {
      const warningMsg = `Team '${teamKey}' has workers but no active team_lead.`;
      console.warn(`⚠️ Warning: ${warningMsg}`);
      report.warnings.push(warningMsg);
    }
  }

  // Create assignments
  for (const [teamKey, leads] of leadsByTeam.entries()) {
    const matchingWorkers = workers.filter((w) => (w.teamId || w.team) === teamKey);
    for (const lead of leads) {
      for (const worker of matchingWorkers) {
        // Idempotency check: don't create duplicate active assignments
        const existing = await TeamAssignment.findOne({
          teamLeadId: lead._id,
          workerId: worker._id,
          active: true,
        });

        if (!existing) {
          if (dryRun) {
            console.log(`[DRY-RUN] Would create TeamAssignment: Lead ${lead.email} -> Worker ${worker.email} (Team: ${teamKey})`);
          } else {
            await TeamAssignment.create({
              teamLeadId: lead._id,
              workerId: worker._id,
              assignedBy: adminUser?._id || lead._id,
              active: true,
              assignedAt: new Date(),
              notes: 'Initial backfill from Roles v2 migration',
            });
          }
          report.teamAssignmentsCreated++;
        }
      }
    }
  }

  console.log(`TeamAssignments created: ${report.teamAssignmentsCreated}`);
  console.log(`Audit logs written: ${report.auditLogsCreated}`);
  console.log('Roles v2 Migration finished successfully.');

  return report;
}

// CLI entry point
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const isDryRun = process.argv.includes('--dry-run');
  const isRollback = process.argv.includes('--rollback');
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal';

  console.log(`Connecting to MongoDB at: ${mongoUri}`);
  await mongoose.connect(mongoUri);

  try {
    const report = await runRolesV2Migration({
      dryRun: isDryRun,
      rollback: isRollback,
    });
    console.log('\n=== MIGRATION SUMMARY ===');
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration failed with error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}
