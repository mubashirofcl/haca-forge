import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Resolve environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import seed routines
import { seedReferenceData } from '../apps/api/src/modules/referenceData/service.js';
import { seedDemoUsers } from './seed-demo-users.js';

// Phase 1 Default Role Map
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

// Collections that belong to Marketing OS and must always be KEPT
const KEEP_COLLECTIONS = new Set(['profiles', 'departments', 'activityevents']);

export async function runMarketingOsReset(cliArgs = process.argv.slice(2), testDbInstance = null) {
  // Helper to parse flags
  const getArg = (flag) => {
    const match = cliArgs.find((a) => a.startsWith(`${flag}=`));
    if (match) return match.split('=')[1];
    return null;
  };
  const hasFlag = (flag) => cliArgs.includes(flag);

  const isConfirmed = hasFlag('--confirm');
  const isRollbackInfo = hasFlag('--rollback-info');
  const dropRetired = hasFlag('--drop-retired');
  const dbNameParam = getArg('--db-name');
  const keepEmailsParam = getArg('--keep-emails');

  if (isRollbackInfo) {
    console.log('\n================================================================');
    console.log('🔄 ROLLBACK / RESTORE INSTRUCTIONS');
    console.log('================================================================');
    console.log('To restore a specific collection from a backup JSON export:');
    console.log('  mongoimport --uri "<mongodb_uri>" --collection <col_name> --file ./backup-db-reset-<timestamp>/<col_name>.json --mode=upsert');
    console.log('\nTo restore an entire database from a mongodump folder:');
    console.log('  mongorestore --uri "<mongodb_uri>" --drop ./backup-before-db-reset/<db_name>');
    console.log('================================================================\n');
    return { mode: 'rollback-info' };
  }

  // 1. Guard: refuse in production
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL SAFETY GUARD: Database reset is strictly prohibited when NODE_ENV is production!');
  }

  // Connect to DB if not provided
  let db;
  if (testDbInstance) {
    db = testDbInstance;
  } else {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
    db = mongoose.connection.db;
  }

  const actualDbName = db.databaseName;

  // 2. Discover collections via listCollections()
  const rawCollections = await db.listCollections().toArray();
  const collectionNames = rawCollections.map((c) => c.name).sort();

  // Inspect document counts and determine actions
  const collectionPlans = [];
  for (const name of collectionNames) {
    const count = await db.collection(name).countDocuments();
    let action = 'EMPTY';
    if (KEEP_COLLECTIONS.has(name)) {
      action = 'KEEP';
    } else if (name === 'users') {
      action = 'RESET-USERS';
    }
    collectionPlans.push({
      collection: name,
      count,
      action,
    });
  }

  // Parse keep-emails
  const keepEmails = keepEmailsParam
    ? keepEmailsParam
        .split(',')
        .map((e) => e.toLowerCase().trim())
        .filter(Boolean)
    : [];

  // Inspect users
  const allUsers = await db.collection('users').find({}).toArray();
  const keptUsersList = [];
  const purgedUsersList = [];

  for (const u of allUsers) {
    const email = (u.email || '').toLowerCase().trim();
    if (keepEmails.includes(email)) {
      keptUsersList.push({
        name: u.name,
        email: u.email,
        role: u.role,
      });
    } else {
      purgedUsersList.push({
        name: u.name,
        email: u.email,
        role: u.role,
      });
    }
  }

  // -------------------------------------------------------------
  // DRY RUN PATH (Default)
  // -------------------------------------------------------------
  if (!isConfirmed) {
    console.log('\n================================================================');
    console.log('🛡️  MARKETING OS DATABASE RESET: DRY RUN MODE (Zero changes made)');
    console.log('================================================================');
    console.log(`Connected Database: ${actualDbName}`);
    console.log(`Total Collections:  ${collectionPlans.length}`);
    console.log(`Kept Emails Filter: ${keepEmails.length > 0 ? keepEmails.join(', ') : '(None provided - required for destructive run)'}\n`);

    console.log('--- COLLECTION ACTION PLAN ---');
    console.table(collectionPlans);

    console.log('\n--- USERS IMPACT ANALYSIS ---');
    console.log(`Total Existing Users: ${allUsers.length}`);
    console.log(`Users to KEEP:        ${keptUsersList.length}`);
    if (keptUsersList.length > 0) {
      console.table(keptUsersList);
    }
    console.log(`Users to PURGE:       ${purgedUsersList.length}`);
    if (purgedUsersList.length > 0) {
      console.table(purgedUsersList.slice(0, 10));
      if (purgedUsersList.length > 10) {
        console.log(`... and ${purgedUsersList.length - 10} more user(s)`);
      }
    }

    console.log('\nℹ️  To execute the destructive reset, you must run:');
    console.log(`   node scripts/reset-data-marketing-os.js --confirm --db-name=${actualDbName} --keep-emails=<email1>,<email2>`);
    console.log('================================================================\n');

    return {
      mode: 'dry-run',
      dbName: actualDbName,
      collectionPlans,
      keptUsers: keptUsersList,
      purgedUsers: purgedUsersList,
    };
  }

  // -------------------------------------------------------------
  // DESTRUCTIVE PATH (Guards required)
  // -------------------------------------------------------------
  // Guard A: db-name must match connected database name
  if (!dbNameParam || dbNameParam !== actualDbName) {
    throw new Error(
      `CRITICAL GUARD FAILED: --db-name parameter is required and must match connected database name exactly. Connected: "${actualDbName}", Received: "${dbNameParam}"`
    );
  }

  // Guard B: keep-emails must be provided and non-empty
  if (keepEmails.length === 0) {
    throw new Error(
      'CRITICAL GUARD FAILED: --keep-emails is required for destructive reset. You must specify at least one account to survive (e.g. --keep-emails=admin@company.com).'
    );
  }

  // Guard C: DEMO_SEED_PASSWORD must be configured
  if (!process.env.DEMO_SEED_PASSWORD) {
    throw new Error(
      'CRITICAL GUARD FAILED: DEMO_SEED_PASSWORD is not configured in environment. Please set DEMO_SEED_PASSWORD in your .env before resetting.'
    );
  }

  console.log('\n⚠️  EXECUTING MARKETING OS DATABASE RESET WITH CONFIRMATION...');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), `./backup-db-reset-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  console.log(`📦 Creating safety backup in: ${backupDir}`);

  // 3. Export all affected collections to JSON and verify non-empty
  for (const plan of collectionPlans) {
    if (plan.action === 'KEEP') continue;

    const docs = await db.collection(plan.collection).find({}).toArray();
    const filePath = path.join(backupDir, `${plan.collection}.json`);
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');

    // Verify file exists and is non-empty if documents existed
    if (plan.count > 0) {
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        throw new Error(
          `BACKUP VERIFICATION FAILED: Exported file ${filePath} is 0 bytes for collection ${plan.collection} with count ${plan.count}. Aborting reset with zero modifications!`
        );
      }
    }
    console.log(`  ✓ Exported ${plan.collection} (${docs.length} docs) -> ${path.basename(filePath)}`);
  }

  // Load migration overrides if present
  let overrides = {};
  const overridesPath = path.resolve(__dirname, './migration-overrides.json');
  if (fs.existsSync(overridesPath)) {
    try {
      overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf-8'));
      console.log('  ✓ Loaded migration overrides from scripts/migration-overrides.json');
    } catch {
      // fallback to default role map
    }
  }

  // 4. Reset Users: Keep only accounts matching keepEmails
  console.log('👤 Updating kept users and removing legacy users...');
  const userRoleMap = { ...DEFAULT_ROLE_MAP, ...overrides };

  for (const kept of keptUsersList) {
    const targetRole = userRoleMap[kept.role] || (['admin', 'marketing_head', 'team_lead', 'team_member'].includes(kept.role) ? kept.role : 'team_member');
    await db.collection('users').updateOne(
      { email: kept.email },
      {
        $set: {
          role: targetRole,
          status: 'active',
          mustSetPassword: false,
        },
        $unset: {
          refreshTokenHash: '',
        },
      }
    );
  }

  const deleteUsersRes = await db.collection('users').deleteMany({
    email: { $nin: keepEmails },
  });
  console.log(`  ✓ Kept ${keptUsersList.length} user(s). Purged ${deleteUsersRes.deletedCount} legacy user(s).`);

  // 5. Empty retired collections
  console.log('🧹 Purging documents in retired collections...');
  for (const plan of collectionPlans) {
    if (plan.action === 'EMPTY') {
      const delRes = await db.collection(plan.collection).deleteMany({});
      console.log(`  ✓ Emptied collection: ${plan.collection} (${delRes.deletedCount} deleted)`);
      if (dropRetired) {
        await db.collection(plan.collection).drop();
        console.log(`    ↳ Dropped retired collection: ${plan.collection}`);
      }
    }
  }

  // 6. Reset counters
  try {
    await db.collection('counters').deleteMany({});
  } catch {}

  // 7. Seed Phase 1 reference taxonomies (7 Profiles, 7 Departments)
  console.log('🌱 Reseeding Marketing OS Reference Data (7 Profiles, 7 Departments)...');
  await seedReferenceData();

  // 8. Seed Part C Demo Users
  console.log('👥 Seeding Part C Demo Users...');
  await seedDemoUsers();

  console.log('\n================================================================');
  console.log('🎉 MARKETING OS DATABASE RESET COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
  console.log(`Safety Backup Stored At: ${backupDir}`);
  console.log('Kept Users surviving reset:');
  console.table(keptUsersList);
  console.log('Purged Users:');
  console.table(purgedUsersList);
  console.log('================================================================\n');

  return {
    mode: 'executed',
    backupDir,
    keptUsers: keptUsersList,
    purgedUsers: purgedUsersList,
  };
}

// Direct CLI invocation
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMarketingOsReset()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('\n❌ RESET ABORTED:', err.message);
      await mongoose.disconnect();
      process.exit(1);
    });
}
