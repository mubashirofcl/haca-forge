import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

// 1. Backward-compatible /status endpoint
router.get('/status', (_req, res) => {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    service: 'marketing-workflow-api',
  });
});

// 2. Liveness probe (/health)
router.get('/health', (_req, res) => {
  return res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 3. Readiness probe (/ready) - verifies MongoDB connection state
router.get('/ready', (_req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;

  const checks = {
    database: isDbConnected ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  if (!isDbConnected) {
    return res.status(503).json({
      status: 'not_ready',
      checks,
    });
  }

  return res.status(200).json({
    status: 'ready',
    checks,
  });
});

export default router;
