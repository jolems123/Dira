/**
 * Claim an email-verification token exactly once. Call ONLY inside a database
 * transaction; a thrown user update must roll back the token claim.
 * The caller must look up the token by its SHA-256 digest, never store plaintext.
 */
export async function consumeEmailVerificationToken(
  tx: {
    emailVerificationToken: { updateMany: (args: any) => Promise<{ count: number }> };
    user: { updateMany: (args: any) => Promise<{ count: number }> };
  },
  input: { id: string; userId: string; now: Date },
): Promise<boolean> {
  if (!Number.isFinite(input.now.getTime())) return false;
  const claimed = await tx.emailVerificationToken.updateMany({
    where: { id: input.id, userId: input.userId, usedAt: null, expiresAt: { gt: input.now } },
    data: { usedAt: input.now },
  });
  if (claimed.count !== 1) return false;
  const updated = await tx.user.updateMany({
    where: { id: input.userId, emailVerified: false },
    data: { emailVerified: true },
  });
  if (updated.count !== 1) throw new Error('Verification user state changed; roll back token claim');
  return true;
}
