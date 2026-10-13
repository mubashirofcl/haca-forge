import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../lib/logger.js';

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;

  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    isConnected = true;
    logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    logger.error({ err: error }, 'MongoDB connection failed');
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

export async function disconnectDB() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB disconnected');
}
