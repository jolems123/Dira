/** Only an active account with an active organisation membership may renew a session. */
export function mayRefreshSession(user: { status: string; organizationMembers: readonly { id: string }[] } | null): boolean {
  return user?.status === 'ACTIVE' && user.organizationMembers.length > 0;
}

/** Revoke all active refresh credentials when the account loses renewal eligibility. */
export async function revokeIneligibleRefreshSessions(
  db: { refreshToken: { updateMany: (args: {
    where: { userId: string; revokedAt: null };
    data: { revokedAt: Date };
  }) => Promise<{ count: number }> } },
  userId: string,
): Promise<void> {
  await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
