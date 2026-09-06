import { PrismaClient } from '@prisma/client';
import { env } from './lib/env';

export const prisma = new PrismaClient({
  datasources: { db: { url: env.databaseUrl } },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
