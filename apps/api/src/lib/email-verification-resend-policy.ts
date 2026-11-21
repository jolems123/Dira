/** Fail closed for malformed timestamps and accounts not awaiting verification. */
export function mayResendVerification(
  account: { status: string; emailVerified: boolean } | null,
  lastIssuedAt: Date | null,
  now: Date,
): boolean {
  const time = now.getTime();
  if (!Number.isFinite(time) || !account || account.status !== 'PENDING_VERIFICATION' || account.emailVerified) return false;
  if (!lastIssuedAt) return true;
  const issued = lastIssuedAt.getTime();
  return Number.isFinite(issued) && issued <= time && time - issued >= 30_000;
}
