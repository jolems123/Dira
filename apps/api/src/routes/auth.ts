import bcrypt from 'bcryptjs';
import { Request, Response, Router } from 'express';
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
const forgotPasswordSchema = z.object({ email: z.string().email().transform((value) => value.toLowerCase()) });
const resetPasswordSchema = z.object({ token: z.string().min(32), password: z.string().min(8) });

function publicUser(user: { id: string; firstName: string; lastName: string; email: string; status: string }, membership?: { organizationId: string; role: string }) {
  return { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, status: user.status, organizationId: membership?.organizationId, role: membership?.role };
}

function tokens(userId: string) {
  const accessToken = jwt.sign({ sub: userId }, env.jwtAccessSecret, { expiresIn: '15m' });
  const refreshToken = crypto.randomBytes(48).toString('hex');
  return { accessToken, refreshToken };
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function setRefreshCookie(res: Response, token: string) {
  const secure = env.nodeEnv === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `dira_refresh_token=${token}; HttpOnly; Path=/api/v1/auth; Max-Age=604800; SameSite=Lax${secure}`);
}

function refreshTokenFromRequest(req: Request) {
  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : '';
  const cookie = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith('dira_refresh_token='));
  return cookie ? decodeURIComponent(cookie.slice('dira_refresh_token='.length)) : (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined);
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
    await prisma.refreshToken.create({ data: { userId: result.user.id, tokenHash: hashToken(issued.refreshToken), expiresAt: new Date(Date.now() + 7 * 86400000) } });
    setRefreshCookie(res, issued.refreshToken);
    return res.status(201).json({ accessToken: issued.accessToken, user: publicUser(result.user, result.membership) });
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
      prisma.refreshToken.create({ data: { userId: user.id, tokenHash: hashToken(issued.refreshToken), expiresAt: new Date(Date.now() + 7 * 86400000) } }),
      prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    ]);
    setRefreshCookie(res, issued.refreshToken);
    return res.json({ accessToken: issued.accessToken, user: publicUser(user, user.organizationMembers[0]) });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/refresh', async (req, res) => {
  const token = z.string().safeParse(refreshTokenFromRequest(req));
  if (!token.success) return res.status(400).json({ message: 'Refresh token is required' });
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token.data) } });
  if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) return res.status(401).json({ message: 'Refresh token is invalid' });
  const issued = tokens(stored.userId);
  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }),
    prisma.refreshToken.create({ data: { userId: stored.userId, tokenHash: hashToken(issued.refreshToken), expiresAt: new Date(Date.now() + 7 * 86400000) } }),
  ]);
  setRefreshCookie(res, issued.refreshToken);
  return res.json({ accessToken: issued.accessToken });
});

authRouter.post('/logout', requireAuth, async (req: AuthenticatedRequest, res) => {
  await prisma.refreshToken.updateMany({ where: { userId: req.user!.id, revokedAt: null }, data: { revokedAt: new Date() } });
  res.setHeader('Set-Cookie', 'dira_refresh_token=; HttpOnly; Path=/api/v1/auth; Max-Age=0; SameSite=Lax');
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

authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    let resetToken: string | undefined;
    if (user && user.status === 'ACTIVE') {
      resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
    }
    const response: { message: string; resetToken?: string } = { message: 'If the account exists, reset instructions will be sent.' };
    if (resetToken && env.nodeEnv !== 'production') response.resetToken = resetToken;
    return res.json(response);
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
    const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) return res.status(400).json({ message: 'Reset token is invalid or expired' });
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return res.json({ message: 'Password reset successfully' });
  } catch (error) {
    return next(error);
  }
});
