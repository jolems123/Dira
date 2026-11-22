/** Legacy tokens have no explicit organisation selector. Never silently grant a
 * multi-organisation user access to whichever tenant happened to be created first.
 * Explicit organisation switching requires a separately verified tenant claim.
 */
export function selectActiveMembership<T extends { organizationId: string; role?: unknown; status: string; createdAt: Date }>(
  memberships: readonly T[],
): T | undefined {
  const active = memberships.filter((membership) => membership.status === 'ACTIVE');
  if (active.length !== 1) return undefined;
  const only = active[0];
  if (typeof only.organizationId !== 'string' || !only.organizationId.trim() || only.organizationId !== only.organizationId.trim() || typeof only.role !== 'string' || !only.role.trim() || only.role !== only.role.trim() || !(only.createdAt instanceof Date) || !Number.isFinite(only.createdAt.getTime())) {
    return undefined;
  }
  return only;
}
