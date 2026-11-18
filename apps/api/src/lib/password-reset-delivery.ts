/** Mark a failed-to-deliver reset credential unusable without touching other tokens.
 * A bounded retry handles transient database errors. Persistent failures still
 * propagate to the caller and MUST NOT be interpreted as confirmed revocation.
 */
export async function revokeUndeliveredResetToken(
  db: { passwordResetToken: { updateMany: (args: { where: { tokenHash: string; usedAt: null }; data: { usedAt: Date } }) => Promise<{ count: number }> } },
  tokenHash: string,
  now: Date,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await db.passwordResetToken.updateMany({ where: { tokenHash, usedAt: null }, data: { usedAt: now } });
      if (result.count !== 1) throw new Error('Password reset cleanup did not revoke a credential');
      return;
    } catch (error) {
      // A successful SQL update cannot be distinguished from a lost acknowledgement.
      // Never retry an ambiguous zero-row result: surface it for operational review.
      if (error instanceof Error && error.message === 'Password reset cleanup did not revoke a credential') throw error;
      if (attempt === 2) throw error;
    }
  }
}
