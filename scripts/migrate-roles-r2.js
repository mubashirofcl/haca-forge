import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { ROLE_KEYS } from '@mmp/shared';

// Resolve environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Migration R2: Role Model Change
 * - marketing_head -> creative_head
 * - team_lead with jobRole === 'Creative Manager (TL)' -> creative_head
 * - every other team_lead -> sm_manager
 * - admin, executive, team_member -> unchanged
 * - scripts/migration-overrides.json (email -> new role) applied last
 * - Invalidate all refresh tokens
 * - Supports dry run, backup collection, --rollback, idempotent
 */
export async function runRoleMigrationR2(cliArgs = process.argv.slice(2), testDbInstance = null) {
  const getArg = (flag) => {
    const match = cliArgs.find((a) => a.startsWith(`${flag}=`));
    if (match) return match.split('=')[1];
    return null;
  };
  const hasFlag = (flag) => cliArgs.includes(flag);

  const isConfirmed = hasFlag('--confirm');
  const isRollback = hasFlag('--rollback');
  const dbNameParam = getArg('--db-name');
  const backupColParam = getArg('--backup-col');
  const overridesPathParam = getArg('--overrides-file');

  // Connect to DB if not provided
  let db;
  let shouldDisconnect = false;
  if (testDbInstance) {
    db = testDbInstance;
  } else {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
      shouldDisconnect = true;
    }
    db = mongoose.connection.db;
  }

  const actualDbName = db.databaseName;

  // Safety guard: refuse production unless explicitly forced
  if (process.env.NODE_ENV === 'production' && !hasFlag('--force-production')) {
    throw new Error('CRITICAL SAFETY GUARD: Role migration is refused when NODE_ENV is production without --force-production!');
  }

  const usersCol = db.collection('users');

  // -------------------------------------------------------------
  // ROLLBACK PATH
  // -------------------------------------------------------------
  if (isRollback) {
    console.log('\n================================================================');
    console.log('🔄 MARKETING OS ROLE MIGRATION: ROLLBACK MODE');
    console.log('================================================================');

    let backupCollectionName = backupColParam;
    if (!backupCollectionName) {
      // Find latest users_backup_r2_* collection
      const cols = await db.listCollections().toArray();
      const backupCols = cols
        .map((c) => c.name)
        .filter((name) => name.startsWith('users_backup_r2_'))
        .sort()
        .reverse();

      if (backupCols.length === 0) {
        throw new Error('No users_backup_r2_* collection found to rollback from.');
      }
      backupCollectionName = backupCols[0];
    }

    console.log(`Restoring 'users' collection from backup: '${backupCollectionName}'`);
    const backupCol = db.collection(backupCollectionName);
    const backupDocs = await backupCol.find({}).toArray();

    if (backupDocs.length === 0) {
      throw new Error(`Backup collection '${backupCollectionName}' is empty. Aborting rollback.`);
    }

    // Delete existing users and re-insert backup docs
    await usersCol.deleteMany({});
    await usersCol.insertMany(backupDocs);

    console.log(`✅ Successfully restored ${backupDocs.length} user records from '${backupCollectionName}'.`);
    console.log('================================================================\n');

    if (shouldDisconnect) {
      await mongoose.disconnect();
    }

    return {
      success: true,
      mode: 'rollback',
      restoredFrom: backupCollectionName,
      restoredCount: backupDocs.length,
    };
  }

  // Load overrides if available
  const overridesPath = overridesPathParam || path.resolve(__dirname, 'migration-overrides.json');
  let overrides = {};
  if (fs.existsSync(overridesPath)) {
    try {
      const raw = fs.readFileSync(overridesPath, 'utf8');
      overrides = JSON.parse(raw);
    } catch (err) {
      console.warn(`⚠️ Warning: could not parse overrides file at ${overridesPath}:`, err.message);
    }
  }

  // Inspect all users
  const allUsers = await usersCol.find({}).toArray();

  const migrationPlan = [];
  let migratedCount = 0;
  let unchangedCount = 0;
  let overridesCount = 0;

  for (const user of allUsers) {
    const oldRole = user.role || 'team_member';
    let newRole = oldRole;

    // Mapping logic
    if (oldRole === 'marketing_head') {
      newRole = 'creative_head';
    } else if (oldRole === 'team_lead') {
      if (user.jobRole === 'Creative Manager (TL)') {
        newRole = 'creative_head';
      } else {
        newRole = 'sm_manager';
      }
    } else if (ROLE_KEYS.includes(oldRole)) {
      newRole = oldRole;
    }

    // Apply overrides last if specified for this email
    const emailKey = (user.email || '').toLowerCase().trim();
    let overrideApplied = false;
    if (overrides[emailKey]) {
      const targetRole = overrides[emailKey];
      if (ROLE_KEYS.includes(targetRole)) {
        newRole = targetRole;
        overrideApplied = true;
        overridesCount++;
      } else {
        console.warn(`⚠️ Invalid target role "${targetRole}" specified in overrides for ${emailKey}. Ignored.`);
      }
    }

    const isChanged = oldRole !== newRole;
    if (isChanged) {
      migratedCount++;
    } else {
      unchangedCount++;
    }

    migrationPlan.push({
      id: user._id.toString(),
      name: user.name || 'Unnamed',
      email: user.email || 'No email',
      jobRole: user.jobRole || 'None',
      oldRole,
      newRole,
      isChanged,
      overrideApplied,
    });
  }

  // -------------------------------------------------------------
  // DRY RUN PATH (Default)
  // -------------------------------------------------------------
  if (!isConfirmed) {
    console.log('\n================================================================');
    console.log('🛡️  MARKETING OS ROLE MIGRATION R2: DRY RUN (Zero changes made)');
    console.log('================================================================');
    console.log(`Connected Database: ${actualDbName}`);
    console.log(`Total Users Found:  ${allUsers.length}`);
    console.log(`Users to Migrate:   ${migratedCount}`);
    console.log(`Users Unchanged:    ${unchangedCount}`);
    console.log(`Overrides Applied:  ${overridesCount}\n`);

    console.log('--- USER ROLE MIGRATION PLAN ---');
    console.table(
      migrationPlan.map((u) => ({
        Name: u.name,
        Email: u.email,
        'Job Role': u.jobRole,
        'Old Role': u.oldRole,
        'New Role': u.newRole,
        Status: u.isChanged ? '🔄 MIGRATE' : '✓ KEEP',
        Override: u.overrideApplied ? 'YES' : 'NO',
      }))
    );

    console.log('\nℹ️  To execute the live migration, run with --confirm and --db-name:');
    console.log(`   node scripts/migrate-roles-r2.js --confirm --db-name=${actualDbName}`);
    console.log('================================================================\n');

    if (shouldDisconnect) {
      await mongoose.disconnect();
    }

    return {
      mode: 'dry-run',
      dbName: actualDbName,
      totalUsers: allUsers.length,
      migratedCount,
      unchangedCount,
      overridesCount,
      migrationPlan,
    };
  }

  // -------------------------------------------------------------
  // MUTATION PATH (Requires --confirm and --db-name)
  // -------------------------------------------------------------
  if (!dbNameParam || dbNameParam !== actualDbName) {
    throw new Error(
      `CRITICAL GUARD: --db-name is required and must match connected DB name exactly. Connected: "${actualDbName}", Received: "${dbNameParam}"`
    );
  }

  console.log('\n🚀 EXECUTING ROLE MIGRATION R2 WITH CONFIRMATION...');

  // 1. Create backup collection
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupCollectionName = `users_backup_r2_${timestamp}`;
  const backupCol = db.collection(backupCollectionName);

  if (allUsers.length > 0) {
    await backupCol.insertMany(allUsers);
    console.log(`📦 Created backup collection: '${backupCollectionName}' with ${allUsers.length} documents.`);
  }

  // 2. Perform updates and invalidate all refresh tokens
  let updatedInDb = 0;
  for (const item of migrationPlan) {
    const updateOps = {
      $set: { role: item.newRole },
      $unset: { refreshTokenHash: 1 },
    };

    const res = await usersCol.updateOne(
      { _id: new mongoose.Types.ObjectId(item.id) },
      updateOps
    );
    if (res.modifiedCount > 0) {
      updatedInDb += res.modifiedCount;
    }
  }

  console.log(`✅ Successfully updated ${updatedInDb} user record(s).`);
  console.log('🔒 Invalidated all refresh tokens to enforce session re-authentication with new permissions.');
  console.log(`Backup preserved at '${backupCollectionName}'. Rollback anytime using:`);
  console.log(`   node scripts/migrate-roles-r2.js --rollback --backup-col=${backupCollectionName}\n`);

  if (shouldDisconnect) {
    await mongoose.disconnect();
  }

  return {
    success: true,
    mode: 'confirmed',
    dbName: actualDbName,
    backupCollection: backupCollectionName,
    updatedCount: updatedInDb,
    migrationPlan,
  };
}

// CLI execution
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runRoleMigrationR2()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err.message);
      process.exit(1);
    });
}
