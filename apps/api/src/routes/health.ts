import { Router } from 'express';
import { prisma } from '../db';

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
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ ok: true, status: 'ready', database: 'connected', environment: process.env.NODE_ENV ?? 'development' });
  } catch {
    return res.status(503).json({ ok: false, status: 'not_ready', database: 'unavailable' });
  }
});
