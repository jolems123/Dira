import { canonicalEmail } from '../lib/auth-email';
import { issueEmailVerificationAtomically } from '../lib/email-verification-issue';
import { revokeUndeliveredVerificationToken } from '../lib/email-verification-revoke';
import { safelyRevokeUndeliveredVerification } from '../lib/email-verification-safe-revoke';
import { sendEmailVerificationEmail } from '../lib/email-verification-email';
import { validEmailVerificationToken } from '../lib/email-verification-token';
import { consumeEmailVerificationToken } from '../lib/email-verification-consume';
import { sendPasswordResetEmail } from '../lib/password-reset-email';
import { shouldAttemptPasswordResetDelivery } from '../lib/password-reset-delivery-policy';
import { publicPasswordResetResponse } from '../lib/password-reset-response';
import { consumeResetToken } from '../lib/password-reset';
import { revokeUndeliveredResetToken } from '../lib/password-reset-delivery';
import { issuePasswordResetAtomically } from '../lib/password-reset-issue';
import { passwordInput } from '../lib/password-input';
import { validRefreshToken } from '../lib/refresh-token-format';
import { validPasswordResetToken } from '../lib/password-reset-token-format';
import { parseRefreshCookie, refreshCookieHeader, clearRefreshCookieHeader } from '../lib/refresh-cookie';
import bcrypt from 'bcryptjs';
import { Request, Response, Router } from 'express';
import crypto from 'node:crypto';
import { signAccessToken } from '../lib/access-token';
import { selectActiveMembership } from '../lib/active-membership';
import { mayRefreshSession, revokeIneligibleRefreshSessions } from '../lib/refresh-eligibility';
import { z } from 'zod';
import { prisma } from '../db';
import { env } from '../lib/env';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const registerSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().trim().email().transform(canonicalEmail),
  password: passwordInput,
  organizationName: z.string().min(2).optional(),
  organizationType: z.enum(['BUYER', 'SUPPLIER', 'BOTH']).default('BUYER'),
});
const verifyEmailSchema = z.object({ token: z.string().refine(validEmailVerificationToken, 'Invalid verification token format') });
const loginSchema = z.object({ email: z.string().trim().email().transform(canonicalEmail), password: passwordInput });
const forgotPasswordSchema = z.object({ email: z.string().trim().email().transform(canonicalEmail) });
const resetPasswordSchema = z.object({ token: z.string().refine(validPasswordResetToken, 'Invalid reset token format'), password: passwordInput });

function publicUser(user: { id: string; firstName: string; lastName: string; email: string; status: string }, membership?: { organizationId: string; role: string }) {
  return { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, status: user.status, organizationId: membership?.organizationId, role: membership?.role };
}

function tokens(userId: string) {
  const accessToken = signAccessToken(userId, env.jwtAccessSecret);
  const refreshToken = crypto.randomBytes(48).toString('hex');
  return { accessToken, refreshToken };
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function setRefreshCookie(res: Response, token: string) {
  res.setHeader('Set-Cookie', refreshCookieHeader(token, env.nodeEnv === 'production'));
}

function refreshTokenFromRequest(req: Request) {
  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : '';
  const cookie = parseRefreshCookie(cookieHeader);
  if (cookieHeader.split(';').some((part) => part.trim().startsWith('dira_refresh_token='))) return cookie;
  return typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined;
}

export const authRouter = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { firstName: parsed.data.firstName, lastName: parsed.data.lastName, email: parsed.data.email, passwordHash, status: 'PENDING_VERIFICATION', emailVerified: false },
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
    // Persist the one-time credential only after the account transaction commits.
    // Registration must never return an authentication or verification bearer token.
    const verificationToken = await issueEmailVerificationAtomically(prisma, result.user.id, new Date());
    if (!verificationToken) throw new Error('Unable to issue verification credential');
    try {
      await sendEmailVerificationEmail({
        token: verificationToken,
        email: result.user.email,
        webOrigin: env.webOrigin,
        apiKey: process.env.RESEND_API_KEY ?? '',
        from: process.env.DIRA_EMAIL_FROM ?? '',
      });
    } catch {
      // A failed delivery must not leave a usable bearer credential behind.
      // Keep the account pending so it cannot authenticate.
      console.error('Registration verification email delivery failed');
      await safelyRevokeUndeliveredVerification((userId, tokenHash) => revokeUndeliveredVerificationToken(prisma, userId, tokenHash, new Date()), result.user.id, hashToken(verificationToken));
      return res.status(503).json({ message: 'Verification email could not be delivered. Please try again later.' });
    }
    return res.status(201).json({ message: 'Registration received. Email verification is required before sign-in.', user: publicUser(result.user, result.membership) });
  } catch (error) {
    return next(error);
  }
});


const resendVerificationSchema = z.object({ email: z.string().trim().email().transform(canonicalEmail) });
const resendVerificationResponse = { message: 'If this address needs verification, a message may be sent.' };

authRouter.post('/resend-verification', async (req, res, next) => {
  try {
    const parsed = resendVerificationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid email' });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, email: true, status: true, emailVerified: true } });
    if (!user || user.status !== 'PENDING_VERIFICATION' || user.emailVerified) return res.json(resendVerificationResponse);
    // The cooldown check runs inside the same PostgreSQL row lock as issuance.
    const token = await issueEmailVerificationAtomically(prisma, user.id, new Date(), true);
    if (!token) return res.json(resendVerificationResponse);
    try {
      await sendEmailVerificationEmail({
        token, email: user.email, webOrigin: env.webOrigin,
        apiKey: process.env.RESEND_API_KEY ?? '', from: process.env.DIRA_EMAIL_FROM ?? '',
      });
    } catch {
      console.error('Verification resend delivery failed');
      await safelyRevokeUndeliveredVerification((userId, tokenHash) => revokeUndeliveredVerificationToken(prisma, userId, tokenHash, new Date()), user.id, hashToken(token));
    }
    return res.json(resendVerificationResponse);
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/verify-email', async (req, res, next) => {
  try {
    const parsed = verifyEmailSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid or expired verification token' });
    const tokenHash = hashToken(parsed.data.token);
    const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }
    const consumed = await prisma.$transaction((tx) =>
      consumeEmailVerificationToken(tx, { id: record.id, userId: record.userId, now: new Date() }),
    );
    if (!consumed) return res.status(400).json({ message: 'Invalid or expired verification token' });
    return res.json({ message: 'Email verified. You can now sign in.' });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, include: { organizationMembers: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } } } });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password' });
    if (user.status !== 'ACTIVE') return res.status(403).json({ message: 'Account is not active' });
    // Do not issue new credentials before ownership of the email address is verified.
    if (user.emailVerified !== true) return res.status(403).json({ message: 'Email verification required' });
    const membership = selectActiveMembership(user.organizationMembers);
    if (!membership) return res.status(403).json({ message: 'Active organisation membership required' });
    const issued = tokens(user.id);
    await prisma.$transaction([
      prisma.refreshToken.create({ data: { userId: user.id, tokenHash: hashToken(issued.refreshToken), expiresAt: new Date(Date.now() + 7 * 86400000) } }),
      prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    ]);
    setRefreshCookie(res, issued.refreshToken);
    return res.json({ accessToken: issued.accessToken, user: publicUser(user, membership) });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const token = refreshTokenFromRequest(req);
    if (!validRefreshToken(token)) {
      res.setHeader('Set-Cookie', clearRefreshCookieHeader(env.nodeEnv === 'production'));
      return res.status(400).json({ message: 'Invalid refresh token format' });
    }
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!stored) {
      res.setHeader('Set-Cookie', clearRefreshCookieHeader(env.nodeEnv === 'production'));
      return res.status(401).json({ message: 'Refresh token is invalid' });
    }

    // A previously rotated credential is evidence of replay. Revoke every active
    // refresh credential for this account so the rotated child cannot survive.
    if (stored.revokedAt) {
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      res.setHeader('Set-Cookie', clearRefreshCookieHeader(env.nodeEnv === 'production'));
      return res.status(401).json({ message: 'Refresh token replay detected; sign in again' });
    }
    if (stored.expiresAt <= new Date()) {
      res.setHeader('Set-Cookie', clearRefreshCookieHeader(env.nodeEnv === 'production'));
      return res.status(401).json({ message: 'Refresh token has expired' });
    }

    const user = await prisma.user.findUnique({
      where: { id: stored.userId },
      select: { status: true, emailVerified: true, organizationMembers: { where: { status: 'ACTIVE' }, select: { id: true }, take: 2 } },
    });
    if (!mayRefreshSession(user)) {
      await revokeIneligibleRefreshSessions(prisma, stored.userId);
      res.setHeader('Set-Cookie', clearRefreshCookieHeader(env.nodeEnv === 'production'));
      return res.status(401).json({ message: 'Session invalid' });
    }

    const issued = tokens(stored.userId);
    // Compare-and-swap ensures that concurrent refresh calls never both succeed.
    const succeeded = await prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
      if (claimed.count !== 1) return false;
      await tx.refreshToken.create({
        data: { userId: stored.userId, tokenHash: hashToken(issued.refreshToken), expiresAt: new Date(Date.now() + 7 * 86400000) },
      });
      return true;
    });
    if (!succeeded) {
      await prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      res.setHeader('Set-Cookie', clearRefreshCookieHeader(env.nodeEnv === 'production'));
      return res.status(401).json({ message: 'Refresh token replay detected; sign in again' });
    }
    setRefreshCookie(res, issued.refreshToken);
    return res.json({ accessToken: issued.accessToken });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/logout', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    await prisma.refreshToken.updateMany({ where: { userId: req.user!.id, revokedAt: null }, data: { revokedAt: new Date() } });
    res.setHeader('Set-Cookie', clearRefreshCookieHeader(env.nodeEnv === 'production'));
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { organizationMembers: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' }, include: { organization: true } } },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const membership = selectActiveMembership(user.organizationMembers);
    return res.json({
      user: publicUser(user, membership),
      organization: membership
        ? { id: membership.organization.id, name: membership.organization.legalName, type: membership.organization.type }
        : null,
    });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    let resetToken: string | undefined;
    if (user && user.status === 'ACTIVE') {
      resetToken = (await issuePasswordResetAtomically(prisma, user.id, new Date())) ?? undefined;
      if (!resetToken) {
        return res.json(publicPasswordResetResponse());
      }
      if (shouldAttemptPasswordResetDelivery(env.nodeEnv)) {
        try {
          await sendPasswordResetEmail({
            token: resetToken,
            email: user.email,
            webOrigin: env.webOrigin,
            apiKey: process.env.RESEND_API_KEY ?? '',
            from: process.env.DIRA_EMAIL_FROM ?? '',
          });
        } catch {
          // Do not reveal whether this address belongs to an account or log the reset token.
          console.error('Password reset email delivery failed');
          try {
            await revokeUndeliveredResetToken(prisma, hashToken(resetToken), new Date());
          } catch {
            console.error('Failed to revoke undelivered password reset credential');
          }
        }
      }
    }
    // Never expose bearer reset credentials through HTTP, including preview deployments.
    return res.json(publicPasswordResetResponse());
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
    const consumed = await prisma.$transaction((tx) =>
      consumeResetToken(tx, { id: reset.id, userId: reset.userId, passwordHash, now: new Date() }),
    );
    if (!consumed) return res.status(400).json({ message: 'Reset token is invalid or expired' });
    return res.json({ message: 'Password reset successfully' });
  } catch (error) {
    return next(error);
  }
});
