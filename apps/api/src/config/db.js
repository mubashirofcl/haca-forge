import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../lib/logger.js';

let isConnected = false;

export async function connectDB(retries = 5, delayMs = 2000) {
  if (isConnected) return;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(env.MONGODB_URI);
      isConnected = true;
      logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    } catch (error) {
      if (attempt === retries) {
        logger.error({ err: error }, `MongoDB connection failed after ${retries} attempts`);
        if (env.NODE_ENV === 'production') {
          process.exit(1);
        }
        throw error;
      }
      logger.warn(`MongoDB connection attempt ${attempt}/${retries} failed (${error.message}). Retrying in ${delayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function disconnectDB() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB disconnected');
}
