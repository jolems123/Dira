import bcrypt from 'bcryptjs';
import { Router } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db';
import { env } from '../lib/env';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const registerSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8),
  organizationName: z.string().min(2).optional(),
  organizationType: z.enum(['BUYER', 'SUPPLIER', 'BOTH']).default('BUYER'),
});
const loginSchema = z.object({ email: z.string().email().transform((value) => value.toLowerCase()), password: z.string().min(8) });

function publicUser(user: { id: string; firstName: string; lastName: string; email: string; status: string }, membership?: { organizationId: string; role: string }) {
  return { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, status: user.status, organizationId: membership?.organizationId, role: membership?.role };
}

function tokens(userId: string) {
  const accessToken = jwt.sign({ sub: userId }, env.jwtAccessSecret, { expiresIn: '15m' });
  const refreshToken = crypto.randomBytes(48).toString('hex');
  return { accessToken, refreshToken };
}

export const authRouter = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { firstName: parsed.data.firstName, lastName: parsed.data.lastName, email: parsed.data.email, passwordHash, status: 'ACTIVE', emailVerified: false },
      });
      const organizationType = parsed.data.organizationType;
      const organization = await tx.organization.create({
        data: {
          legalName: parsed.data.organizationName ?? `${parsed.data.firstName}'s Organization`,
          type: organizationType,
        },
      });
      const membership = await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: organizationType === 'SUPPLIER' || organizationType === 'BOTH' ? 'SUPPLIER_MANAGER' : 'OWNER',
        },
      });
      return { user, membership };
    });
    const issued = tokens(result.user.id);
    await prisma.refreshToken.create({ data: { userId: result.user.id, token: issued.refreshToken, expiresAt: new Date(Date.now() + 7 * 86400000) } });
    return res.status(201).json({ ...issued, user: publicUser(result.user, result.membership) });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, include: { organizationMembers: { take: 1 } } });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password' });
    if (user.status !== 'ACTIVE') return res.status(403).json({ message: 'Account is not active' });
    const issued = tokens(user.id);
    await prisma.$transaction([
      prisma.refreshToken.create({ data: { userId: user.id, token: issued.refreshToken, expiresAt: new Date(Date.now() + 7 * 86400000) } }),
      prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    ]);
    return res.json({ ...issued, user: publicUser(user, user.organizationMembers[0]) });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/refresh', async (req, res) => {
  const token = z.string().safeParse(req.body?.refreshToken);
  if (!token.success) return res.status(400).json({ message: 'Refresh token is required' });
  const stored = await prisma.refreshToken.findUnique({ where: { token: token.data } });
  if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) return res.status(401).json({ message: 'Refresh token is invalid' });
  const issued = tokens(stored.userId);
  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }),
    prisma.refreshToken.create({ data: { userId: stored.userId, token: issued.refreshToken, expiresAt: new Date(Date.now() + 7 * 86400000) } }),
  ]);
  return res.json(issued);
});

authRouter.post('/logout', requireAuth, async (req: AuthenticatedRequest, res) => {
  await prisma.refreshToken.updateMany({ where: { userId: req.user!.id, revokedAt: null }, data: { revokedAt: new Date() } });
  return res.status(204).send();
});

authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { organizationMembers: { take: 1, include: { organization: true } } },
  });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const membership = user.organizationMembers[0];
  return res.json({
    user: publicUser(user, membership),
    organization: membership
      ? { id: membership.organization.id, name: membership.organization.legalName, type: membership.organization.type }
      : null,
  });
});

authRouter.post('/forgot-password', (_req, res) => res.json({ message: 'If the account exists, reset instructions will be sent.' }));
