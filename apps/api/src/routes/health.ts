import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'dira-api',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

healthRouter.get('/ready', async (_req, res) => {
  res.json({
    ok: true,
    status: 'ready',
    database: 'configured',
    environment: process.env.NODE_ENV ?? 'development',
  });
});
