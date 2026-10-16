import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { runDeliverableMigration } from '../src/modules/deliverables/migration.js';

async function main() {
  console.log('Connecting to MongoDB at:', env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  try {
    const result = await runDeliverableMigration();
    console.log('Migration Result:', result);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

main();
