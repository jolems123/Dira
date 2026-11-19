import type { PrismaClient } from '@prisma/client';
import { createEmailVerificationCredential } from './email-verification-credential';

/**
 * Serialize issuance per account using a PostgreSQL row lock. Only the hash
 * enters the database; send the plaintext token by email after commit.
 * A failed delivery must be handled by revoking the newly issued hash.
 */
export async function issueEmailVerificationAtomically(
  db: Pick<PrismaClient, '$transaction'>,
  userId: string,
  now: Date,
): Promise<string | null> {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid issuance time');
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    if (locked.length !== 1) return null;
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { status: true, emailVerified: true },
    });
    if (!user || user.status !== 'PENDING_VERIFICATION' || user.emailVerified) return null;
    const credential = createEmailVerificationCredential(now);
    await tx.emailVerificationToken.deleteMany({ where: { userId, usedAt: null } });
    await tx.emailVerificationToken.create({
      data: { userId, tokenHash: credential.tokenHash, expiresAt: credential.expiresAt },
    });
    return credential.token;
  });
}
