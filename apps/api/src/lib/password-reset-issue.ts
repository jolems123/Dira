import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { mayIssuePasswordReset } from './password-reset-cooldown';

/**
 * Serializes reset issuance for one user by locking the User row within the
 * same PostgreSQL transaction as the cooldown read and token replacement.
 * Never send email inside this transaction.
 */
export async function issuePasswordResetAtomically(
  db: Pick<PrismaClient, '$transaction'>,
  userId: string,
  now: Date,
): Promise<string | null> {
  return db.$transaction(async (tx) => {
    // Row-level lock: concurrent requests for this user wait, then see the
    // freshly committed token. Other users' reset requests remain independent.
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    if (locked.length !== 1) throw new Error('Reset account unavailable');

    const latest = await tx.passwordResetToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (!mayIssuePasswordReset(latest, now)) return null;

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await tx.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
    await tx.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt: new Date(now.getTime() + 30 * 60_000) },
    });
    return token;
  });
}
