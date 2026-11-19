import type { PrismaClient } from '@prisma/client';

/**
 * A delivery failure must invalidate its bearer credential without erasing
 * issuance history: deleting the row would bypass the resend cooldown.
 * Conditional update avoids revoking a credential already consumed/replaced.
 */
export async function revokeUndeliveredVerificationToken(
  db: Pick<PrismaClient, 'emailVerificationToken'>,
  userId: string,
  tokenHash: string,
  now: Date,
): Promise<boolean> {
  if (!userId || !/^[a-f0-9]{64}$/.test(tokenHash) || !Number.isFinite(now.getTime())) {
    throw new Error('Invalid verification revocation input');
  }
  const result = await db.emailVerificationToken.updateMany({
    where: { userId, tokenHash, usedAt: null },
    data: { usedAt: now },
  });
  return result.count === 1;
}
