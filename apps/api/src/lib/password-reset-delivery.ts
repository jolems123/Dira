/** Mark a failed-to-deliver reset credential unusable without touching other tokens. */
export async function revokeUndeliveredResetToken(
  db: { passwordResetToken: { updateMany: (args: { where: { tokenHash: string; usedAt: null }; data: { usedAt: Date } }) => Promise<{ count: number }> } },
  tokenHash: string,
  now: Date,
): Promise<void> {
  await db.passwordResetToken.updateMany({ where: { tokenHash, usedAt: null }, data: { usedAt: now } });
}
