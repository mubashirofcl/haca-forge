import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });

const REMOVED_COLLECTIONS = [
  'campaigns',
  'monthlytargets',
  'leads',
  'dataissues',
  'syncruns',
];

const REMOVED_WORK_ITEM_FIELDS = [
  'campaignId',
  'relatedOKR',
  'relatedTarget',
  'leadsGenerated',
  'qualifiedLeads',
];

export function validateHostAndEnvironment(uri) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to execute scope reset: NODE_ENV is set to production.');
  }

  // Parse host from mongodb URI
  const parsed = new URL(uri.replace('mongodb://', 'http://').replace('mongodb+srv://', 'http://'));
  const host = parsed.hostname;
  const isLocal = host === '127.0.0.1' || host === 'localhost';

  if (!isLocal) {
    throw new Error(`Refusing to execute scope reset on non-local host: "${host}". Only localhost/127.0.0.1 allowed.`);
  }

  return { host, pathname: parsed.pathname.replace(/^\//, '') };
}

export async function runScopeResetR1(options = {}) {
  const argv = options.argv || process.argv.slice(2);
  const isConfirm = argv.includes('--confirm');
  const isDropCollections = argv.includes('--drop-collections');
  const dbNameArg = argv.find((a) => a.startsWith('--db-name='))?.split('=')[1];

  const uri = options.uri || process.env.MONGODB_URI_TEST || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal';
  const { host, pathname } = validateHostAndEnvironment(uri);

  const targetDbName = pathname || 'marketing_portal';

  if (isConfirm) {
    if (!dbNameArg) {
      throw new Error('--confirm requires --db-name=<exact name> (e.g. --db-name=marketing_portal)');
    }
    if (dbNameArg !== targetDbName) {
      throw new Error(`--db-name "${dbNameArg}" does not match target database "${targetDbName}". Aborting.`);
    }
  }

  const isDryRun = !isConfirm;

  console.log('='.repeat(70));
  console.log('  SCOPE RESET R1: Leads, Campaigns & Monthly Targets Cleanup');
  console.log(`  Mode: ${isDryRun ? 'DRY RUN (default - no changes will be made)' : 'LIVE EXECUTION (--confirm)'}`);
  console.log(`  Host: ${host}`);
  console.log(`  Database: ${targetDbName}`);
  console.log(`  Drop Collections: ${isDropCollections ? 'YES' : 'NO'}`);
  console.log('='.repeat(70));

  const shouldDisconnect = options.disconnect !== undefined ? options.disconnect : (mongoose.connection.readyState === 0);
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
  const db = mongoose.connection.db;

  const existingCollections = (await db.listCollections().toArray()).map((c) => c.name);

  // 1. Audit Collections to Remove
  const collectionCounts = {};
  for (const collName of REMOVED_COLLECTIONS) {
    if (existingCollections.includes(collName)) {
      collectionCounts[collName] = await db.collection(collName).countDocuments();
    } else {
      collectionCounts[collName] = 0;
    }
  }

  // 2. Audit WorkItems Removed Fields
  const workItemFilter = {
    $or: REMOVED_WORK_ITEM_FIELDS.map((f) => ({ [f]: { $exists: true } })),
  };
  const workitemsCount = existingCollections.includes('workitems')
    ? await db.collection('workitems').countDocuments(workItemFilter)
    : 0;

  console.log('\n[AUDIT] Documents identified for removal:');
  for (const [coll, count] of Object.entries(collectionCounts)) {
    const status = existingCollections.includes(coll) ? `${count} document(s)` : 'collection does not exist';
    console.log(`  - ${coll.padEnd(16)}: ${status}`);
  }
  console.log(`  - workitems (fields): ${workitemsCount} document(s) with deprecated fields (${REMOVED_WORK_ITEM_FIELDS.join(', ')})`);

  if (isDryRun) {
    console.log('\n[DRY RUN SUMMARY]');
    console.log(`  * Would export all documents from 5 collections to: ./backup-r1-<timestamp>/`);
    console.log(`  * Would export ${workitemsCount} work item field snapshots to: ./backup-r1-<timestamp>/workitems_removed_fields.json`);
    console.log(`  * Would delete documents from: ${REMOVED_COLLECTIONS.join(', ')}`);
    console.log(`  * Would $unset [${REMOVED_WORK_ITEM_FIELDS.join(', ')}] on ${workitemsCount} workitems`);
    if (isDropCollections) {
      console.log(`  * Would drop emptied collections: ${REMOVED_COLLECTIONS.join(', ')}`);
    } else {
      console.log(`  * Collections would be emptied but retained (pass --drop-collections to drop)`);
    }
    if (shouldDisconnect) {
      await mongoose.disconnect();
    }
    return {
      dryRun: true,
      executed: false,
      collectionCounts,
      workitemsCount,
      targetDbName,
    };
  }

  // LIVE EXECUTION
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), `backup-r1-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`\n[BACKUP] Exporting documents to ${backupDir}...`);

  try {
    for (const collName of REMOVED_COLLECTIONS) {
      if (existingCollections.includes(collName)) {
        const docs = await db.collection(collName).find({}).toArray();
        const filePath = path.join(backupDir, `${collName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
        console.log(`  ✓ Exported ${docs.length} document(s) to ${collName}.json`);
      }
    }

    if (existingCollections.includes('workitems')) {
      const projection = { _id: 1 };
      for (const f of REMOVED_WORK_ITEM_FIELDS) projection[f] = 1;
      const workItemDocs = await db.collection('workitems').find(workItemFilter, { projection }).toArray();
      const filePath = path.join(backupDir, 'workitems_removed_fields.json');
      fs.writeFileSync(filePath, JSON.stringify(workItemDocs, null, 2), 'utf8');
      console.log(`  ✓ Exported ${workItemDocs.length} work item field snapshot(s) to workitems_removed_fields.json`);
    }
  } catch (err) {
    console.error(`\n[FATAL] Export failed! Aborting before any deletion took place. Error: ${err.message}`);
    await mongoose.disconnect();
    throw err;
  }

  console.log('\n[DELETION] Deleting documents and unsetting fields...');
  for (const collName of REMOVED_COLLECTIONS) {
    if (existingCollections.includes(collName)) {
      const res = await db.collection(collName).deleteMany({});
      console.log(`  ✓ Deleted ${res.deletedCount} document(s) from ${collName}`);
    }
  }

  if (existingCollections.includes('workitems')) {
    const unsetObj = {};
    for (const f of REMOVED_WORK_ITEM_FIELDS) unsetObj[f] = '';
    const res = await db.collection('workitems').updateMany({}, { $unset: unsetObj });
    console.log(`  ✓ Unset removed fields on ${res.modifiedCount} work item(s)`);
  }

  if (isDropCollections) {
    console.log('\n[DROP] Dropping collections...');
    for (const collName of REMOVED_COLLECTIONS) {
      if (existingCollections.includes(collName)) {
        try {
          await db.collection(collName).drop();
          console.log(`  ✓ Dropped collection ${collName}`);
        } catch (dropErr) {
          console.warn(`  ! Could not drop ${collName}: ${dropErr.message}`);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('  SCOPE RESET R1: EXECUTION COMPLETED SUCCESSFULLY');
  console.log(`  Backup saved at: ${backupDir}`);
  console.log('='.repeat(70) + '\n');

  if (shouldDisconnect) {
    await mongoose.disconnect();
  }
  return {
    dryRun: false,
    executed: true,
    backupDir,
    collectionCounts,
    workitemsCount,
  };
}

// Direct CLI invocation
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runScopeResetR1().catch((err) => {
    console.error('\nScope reset script error:', err.message);
    process.exit(1);
  });
}
