import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });

const ROLE_MAP = {
  head: 'marketing_head',
  lead: 'marketing_head',
  worker: 'team_member',
  sm_manager: 'team_member',
  dept_lead: 'suspended',
  dept_staff: 'suspended',
  management: 'executive',
  viewer: 'executive',
};

async function migrateLegacyRoles() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marketing_portal';
  console.log(`Connecting to ${uri}...`);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');

  for (const [legacyRole, targetRole] of Object.entries(ROLE_MAP)) {
    const res = await usersCollection.updateMany(
      { role: legacyRole },
      { $set: { role: targetRole } }
    );
    if (res.modifiedCount > 0) {
      console.log(`Updated ${res.modifiedCount} user(s) with role '${legacyRole}' -> '${targetRole}'`);
    }
  }

  const distinctRoles = await usersCollection.distinct('role');
  console.log('Final distinct roles in users collection:', distinctRoles);
  await mongoose.disconnect();
}

migrateLegacyRoles().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
