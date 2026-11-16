/** Only an active account with an active organisation membership may renew a session. */
export function mayRefreshSession(user: { status: string; organizationMembers: readonly { id: string }[] } | null): boolean {
  return user?.status === 'ACTIVE' && user.organizationMembers.length > 0;
}
