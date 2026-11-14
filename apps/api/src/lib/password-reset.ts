/**
 * Claim a password-reset token exactly once. Caller MUST run this inside a
 * database transaction so a failed password update rolls back token consumption.
 */
export async function consumeResetToken(
  tx: {
    passwordResetToken: { updateMany: (args: any) => Promise<{ count: number }> };
    user: { update: (args: any) => Promise<unknown> };
    refreshToken: { updateMany: (args: any) => Promise<unknown> };
  },
  input: { id: string; userId: string; passwordHash: string; now: Date },
): Promise<boolean> {
  const claimed = await tx.passwordResetToken.updateMany({
    where: { id: input.id, usedAt: null, expiresAt: { gt: input.now } },
    data: { usedAt: input.now },
  });
  if (claimed.count !== 1) return false;
  await tx.user.update({ where: { id: input.userId }, data: { passwordHash: input.passwordHash } });
  await tx.refreshToken.updateMany({ where: { userId: input.userId, revokedAt: null }, data: { revokedAt: input.now } });
  return true;
}
