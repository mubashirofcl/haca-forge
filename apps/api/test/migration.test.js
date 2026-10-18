import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/modules/users/model.js';
import { AccessRequest } from '../src/modules/access/model.js';
import { TeamAssignment } from '../src/modules/teamAssignments/model.js';
import { AuditLog } from '../src/modules/audit/model.js';
import { runRolesV2Migration } from '../../../scripts/migrate-roles-v2.js';

describe('Roles v2 Migration Script Tests', () => {
  const testPrefix = 'mig_test_' + Date.now();
  let adminUser;
  let testLead;
  let testViewer;
  let testTeamLead;
  let testWorker;
  let testAccessReq1;
  let testAccessReq2;

  beforeAll(async () => {
    await connectDB();

    // Clean up any stale backup collections before testing
    const db = mongoose.connection.db;
    if (db) {
      const collections = await db.listCollections().toArray();
      for (const col of collections) {
        if (col.name.startsWith('_backup_users_roles_v1_')) {
          await db.collection(col.name).drop().catch(() => {});
        }
      }
    }

    // Ensure at least one admin exists
    adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Migration Test Admin',
        email: `${testPrefix}_admin@example.com`,
        role: 'admin',
        status: 'active',
      });
    }

    // Create legacy test users
    testLead = await User.create({
      name: 'Legacy Lead User',
      email: `${testPrefix}_lead@example.com`,
      role: 'lead',
      status: 'active',
      refreshTokenHash: 'fake_refresh_token_lead',
    });

    testViewer = await User.create({
      name: 'Legacy Viewer User',
      email: `${testPrefix}_viewer@example.com`,
      role: 'viewer',
      status: 'active',
      refreshTokenHash: 'fake_refresh_token_viewer',
    });

    testTeamLead = await User.create({
      name: 'Migration Test Team Lead',
      email: `${testPrefix}_tl@example.com`,
      role: 'team_lead',
      teamId: `${testPrefix}_team`,
      status: 'active',
    });

    testWorker = await User.create({
      name: 'Migration Test Worker',
      email: `${testPrefix}_worker@example.com`,
      role: 'worker',
      teamId: `${testPrefix}_team`,
      status: 'active',
    });

    // Create legacy access requests
    testAccessReq1 = await AccessRequest.create({
      name: 'Access Req Lead',
      email: `${testPrefix}_ar_lead@example.com`,
      phone: '1234567890',
      department: 'Marketing',
      requestedRole: 'lead',
      reason: 'Testing migration script',
    });

    testAccessReq2 = await AccessRequest.create({
      name: 'Access Req Viewer',
      email: `${testPrefix}_ar_viewer@example.com`,
      phone: '1234567890',
      department: 'Finance',
      requestedRole: 'dept_staff',
      assignedRole: 'viewer',
      reason: 'Testing migration script',
    });
  }, 30000);

  afterAll(async () => {
    // Clean up all test fixture records
    await User.deleteMany({ email: { $regex: testPrefix } });
    await AccessRequest.deleteMany({ email: { $regex: testPrefix } });
    if (testTeamLead && testWorker) {
      await TeamAssignment.deleteMany({
        $or: [{ teamLeadId: testTeamLead._id }, { workerId: testWorker._id }],
      });
    }
    await AuditLog.deleteMany({ entityId: { $in: [testLead?._id?.toString(), testViewer?._id?.toString()] } });

    // Clean up any test backup collections
    const db = mongoose.connection.db;
    if (db) {
      const collections = await db.listCollections().toArray();
      for (const col of collections) {
        if (col.name.startsWith('_backup_users_roles_v1_')) {
          await db.collection(col.name).drop().catch(() => {});
        }
      }
    }

    await disconnectDB();
  }, 30000);

  it('1. Dry run should report changes without mutating the database', async () => {
    const dryRunReport = await runRolesV2Migration({ dryRun: true });

    expect(dryRunReport.mode).toBe('DRY_RUN');
    expect(dryRunReport.usersMigrated).toBeGreaterThanOrEqual(2);

    // Verify database was NOT changed
    const leadCheck = await User.findById(testLead._id).select('+refreshTokenHash');
    expect(leadCheck.role).toBe('lead');
    expect(leadCheck.refreshTokenHash).toBe('fake_refresh_token_lead');

    const viewerCheck = await User.findById(testViewer._id);
    expect(viewerCheck.role).toBe('viewer');

    const arCheck1 = await AccessRequest.findById(testAccessReq1._id);
    expect(arCheck1.requestedRole).toBe('lead');

    const assignmentCheck = await TeamAssignment.findOne({
      teamLeadId: testTeamLead._id,
      workerId: testWorker._id,
    });
    expect(assignmentCheck).toBeNull();
  });

  it('2. Real migration should convert lead->head, viewer->management, backfill assignments and write audit logs', async () => {
    const report = await runRolesV2Migration({ dryRun: false });

    expect(report.mode).toBe('MIGRATE');
    expect(report.usersMigrated).toBeGreaterThanOrEqual(2);
    expect(report.backupCollection).toBeTruthy();

    // Verify lead converted to head and token reset
    const leadUpdated = await User.findById(testLead._id).select('+refreshTokenHash');
    expect(leadUpdated.role).toBe('head');
    expect(leadUpdated.refreshTokenHash).toBeNull();

    // Verify viewer converted to management and token reset
    const viewerUpdated = await User.findById(testViewer._id).select('+refreshTokenHash');
    expect(viewerUpdated.role).toBe('management');
    expect(viewerUpdated.refreshTokenHash).toBeNull();

    // Verify access requests migrated
    const ar1Updated = await AccessRequest.findById(testAccessReq1._id);
    expect(ar1Updated.requestedRole).toBe('head');

    const ar2Updated = await AccessRequest.findById(testAccessReq2._id);
    expect(ar2Updated.assignedRole).toBe('management');

    // Verify TeamAssignment was created
    const assignment = await TeamAssignment.findOne({
      teamLeadId: testTeamLead._id,
      workerId: testWorker._id,
      active: true,
    });
    expect(assignment).toBeTruthy();
    expect(assignment.notes).toBe('Initial backfill from Roles v2 migration');

    // Verify audit logs written
    const auditLogs = await AuditLog.find({
      action: 'user.role.migrated',
      entityId: { $in: [testLead._id.toString(), testViewer._id.toString()] },
    });
    expect(auditLogs.length).toBe(2);
  });

  it('3. Second run should be idempotent with 0 user mutations and no duplicate assignments', async () => {
    const initialAssignmentCount = await TeamAssignment.countDocuments({
      teamLeadId: testTeamLead._id,
      workerId: testWorker._id,
    });

    const secondReport = await runRolesV2Migration({ dryRun: false });

    expect(secondReport.usersMigrated).toBe(0);

    const postAssignmentCount = await TeamAssignment.countDocuments({
      teamLeadId: testTeamLead._id,
      workerId: testWorker._id,
    });
    expect(postAssignmentCount).toBe(initialAssignmentCount);
  });

  it('4. Rollback should restore the original roles, remove backfilled assignments, and revert access requests', async () => {
    const rollbackReport = await runRolesV2Migration({ rollback: true });

    expect(rollbackReport.mode).toBe('ROLLBACK');
    expect(rollbackReport.restoredFromBackup).toBeTruthy();

    // Verify users restored
    const leadRestored = await User.findById(testLead._id);
    expect(leadRestored.role).toBe('lead');

    const viewerRestored = await User.findById(testViewer._id);
    expect(viewerRestored.role).toBe('viewer');

    // Verify access requests reverted
    const ar1Restored = await AccessRequest.findById(testAccessReq1._id);
    expect(ar1Restored.requestedRole).toBe('lead');

    const ar2Restored = await AccessRequest.findById(testAccessReq2._id);
    expect(ar2Restored.assignedRole).toBe('viewer');

    // Verify backfilled TeamAssignment was removed
    const assignmentDeleted = await TeamAssignment.findOne({
      teamLeadId: testTeamLead._id,
      workerId: testWorker._id,
      notes: 'Initial backfill from Roles v2 migration',
    });
    expect(assignmentDeleted).toBeNull();
  });
});
