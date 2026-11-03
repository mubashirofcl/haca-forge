/**
 * scripts/remove-brands.js
 *
 * Removes the brand/profile concept completely for HACA-only operation:
 * - Dry run by default.
 * - Local database only (localhost / 127.0.0.1).
 * - Requires --confirm and --db-name to execute live.
 * - Exports JSON backup OUTSIDE repo before any mutations.
 * - $unset profileId, profileAccess, and lastProfileId across all collections.
 * - Drops profiles collection documents.
 * - Rebuilds indexes that began with profileId without it.
 * - Fully idempotent and rollback-capable.
 *
 * IMPORTANT: DO NOT run with --confirm during automated build.
 *
 * Usage:
 *   node scripts/remove-brands.js                       # Dry run
 *   node scripts/remove-brands.js --confirm --db-name marketing_portal # Execute
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });
dotenv.config();

const args = process.argv.slice(2);
const isConfirm = args.includes('--confirm');
const dbNameIdx = args.indexOf('--db-name');
const specifiedDbName = dbNameIdx !== -1 && args[dbNameIdx + 1] ? args[dbNameIdx + 1] : null;

const rawUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal';

// Safety check: local database only
function assertLocalhost(uri) {
  const isLocal =
    uri.includes('127.0.0.1') ||
    uri.includes('localhost') ||
    uri.includes('::1');
  if (!isLocal) {
    throw new Error(`SAFETY BLOCK: Migration can only run on local database (127.0.0.1/localhost). Found: ${uri}`);
  }
}

async function main() {
  console.log('============================================================');
  console.log(' HACA Marketing OS — Brand Concept Removal Migration');
  console.log(` Mode: ${isConfirm ? 'LIVE (Applying Mutations)' : 'DRY RUN (Preview Only)'}`);
  console.log('============================================================\n');

  assertLocalhost(rawUri);

  if (isConfirm && !specifiedDbName) {
    console.error('ERROR: --db-name <database_name> is required when running with --confirm.');
    process.exit(1);
  }

  // Determine target URI
  let targetUri = rawUri;
  if (specifiedDbName) {
    const parsed = new URL(rawUri);
    parsed.pathname = `/${specifiedDbName}`;
    targetUri = parsed.toString();
  }

  console.log(`Connecting to local MongoDB: ${targetUri}`);
  await mongoose.connect(targetUri);
  const db = mongoose.connection.db;
  console.log('Connected successfully.\n');

  // List existing collections
  const collections = await db.listCollections().toArray();
  const collNames = collections.map((c) => c.name);

  // Collections with fields to clean
  const targets = [
    { name: 'workitems', fields: ['profileId'] },
    { name: 'plans', fields: ['profileId'] },
    { name: 'contentpieces', fields: ['profileId'] },
    { name: 'activityevents', fields: ['profileId'] },
    { name: 'users', fields: ['profileAccess', 'lastProfileId', 'profileId'] },
    { name: 'accessrequests', fields: ['requestedProfileCodes', 'requestedProfileIds', 'assignedProfileAccess'] },
  ];

  console.log('--- 1. ANALYSIS OF BRAND FIELDS ---');
  const counts = {};
  for (const t of targets) {
    if (collNames.includes(t.name)) {
      const orConditions = t.fields.map((f) => ({ [f]: { $exists: true } }));
      const count = await db.collection(t.name).countDocuments({ $or: orConditions });
      counts[t.name] = count;
      console.log(`Collection [${t.name}]: ${count} document(s) carry brand/profile fields [${t.fields.join(', ')}]`);
    } else {
      console.log(`Collection [${t.name}]: not found in database.`);
    }
  }

  let profileDocCount = 0;
  if (collNames.includes('profiles')) {
    profileDocCount = await db.collection('profiles').countDocuments();
    console.log(`Collection [profiles]: ${profileDocCount} document(s) in profiles collection to remove.`);
  }

  if (!isConfirm) {
    console.log('\n[DRY RUN COMPLETE] No modifications were made.');
    console.log('To apply changes live, run with: node scripts/remove-brands.js --confirm --db-name <database_name>');
    await mongoose.disconnect();
    process.exit(0);
  }

  // --- LIVE EXECUTION ---
  // Step 2: Backup OUTSIDE repository before mutation
  const outsideBackupDir = path.resolve(os.tmpdir(), `haca-backup-brands-${Date.now()}`);
  fs.mkdirSync(outsideBackupDir, { recursive: true });
  console.log(`\n--- 2. CREATING PRE-MIGRATION BACKUP OUTSIDE REPO ---`);
  console.log(`Backup destination: ${outsideBackupDir}`);

  for (const t of targets) {
    if (collNames.includes(t.name)) {
      const docs = await db.collection(t.name).find({}).toArray();
      fs.writeFileSync(path.join(outsideBackupDir, `${t.name}.json`), JSON.stringify(docs, null, 2));
      console.log(`  Backed up ${docs.length} document(s) from [${t.name}]`);
    }
  }
  if (collNames.includes('profiles')) {
    const profs = await db.collection('profiles').find({}).toArray();
    fs.writeFileSync(path.join(outsideBackupDir, `profiles.json`), JSON.stringify(profs, null, 2));
    console.log(`  Backed up ${profs.length} document(s) from [profiles]`);
  }

  console.log('Backup completed successfully.\n');

  // Step 3: Unset fields
  console.log('--- 3. UNSETTING BRAND FIELDS ---');
  for (const t of targets) {
    if (collNames.includes(t.name)) {
      const unsetObj = {};
      t.fields.forEach((f) => {
        unsetObj[f] = '';
      });
      const res = await db.collection(t.name).updateMany({}, { $unset: unsetObj });
      console.log(`  [${t.name}]: updated ${res.modifiedCount} document(s).`);
    }
  }

  // Step 4: Drop profiles collection
  console.log('\n--- 4. DROPPING PROFILES COLLECTION ---');
  if (collNames.includes('profiles')) {
    await db.collection('profiles').drop();
    console.log('  Dropped [profiles] collection.');
  }

  // Step 5: Rebuild indexes that had profileId
  console.log('\n--- 5. REBUILDING INDEXES ---');
  if (collNames.includes('workitems')) {
    const existing = await db.collection('workitems').indexes();
    for (const idx of existing) {
      if (idx.key && idx.key.profileId) {
        console.log(`  Dropping obsolete index on workitems: ${idx.name}`);
        try {
          await db.collection('workitems').dropIndex(idx.name);
        } catch (e) {
          console.warn(`    Warning: failed dropping ${idx.name}: ${e.message}`);
        }
      }
    }
    // Ensure replacement indexes
    await db.collection('workitems').createIndex({ status: 1 });
    await db.collection('workitems').createIndex({ departmentId: 1, status: 1, deadline: 1 });
    console.log('  Created replacement indexes on workitems.');
  }

  if (collNames.includes('activityevents')) {
    const existing = await db.collection('activityevents').indexes();
    for (const idx of existing) {
      if (idx.key && idx.key.profileId) {
        console.log(`  Dropping obsolete index on activityevents: ${idx.name}`);
        try {
          await db.collection('activityevents').dropIndex(idx.name);
        } catch (e) {
          console.warn(`    Warning: failed dropping ${idx.name}: ${e.message}`);
        }
      }
    }
    await db.collection('activityevents').createIndex({ timestamp: -1 });
    console.log('  Created replacement index on activityevents.');
  }

  console.log('\n--- BRAND REMOVAL COMPLETE ---');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});

