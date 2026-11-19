/**
 * Best-effort cleanup after a verification email delivery failure.
 * Never log bearer credentials or database errors, which may contain sensitive data.
 * A failed cleanup is an operational alert: the account remains pending, and the
 * token must still expire or be replaced before it can be used.
 */
export async function safelyRevokeUndeliveredVerification(
  revoke: (userId: string, tokenHash: string) => Promise<boolean>,
  userId: string,
  tokenHash: string,
  warn: (message: string) => void = console.error,
): Promise<boolean> {
  try {
    if (await revoke(userId, tokenHash)) return true;
  } catch {
    // Keep the public registration/resend response generic.
  }
  warn('Unable to revoke undelivered verification credential');
  return false;
}
