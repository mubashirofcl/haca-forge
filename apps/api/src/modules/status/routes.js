import { Router } from 'express';

const router = Router();

router.get('/status', (_req, res) => {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    service: 'marketing-workflow-api',
  });
});

export default router;
