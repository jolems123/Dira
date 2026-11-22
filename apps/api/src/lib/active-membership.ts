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
  const hasControlCharacter = (value: string) => /[\x00-\x1f\x7f]/.test(value);
  if (typeof only.organizationId !== 'string' || !only.organizationId.trim() || hasControlCharacter(only.organizationId) || only.organizationId !== only.organizationId.trim() || typeof only.role !== 'string' || !only.role.trim() || hasControlCharacter(only.role) || only.role !== only.role.trim() || !(only.createdAt instanceof Date) || !Number.isFinite(only.createdAt.getTime())) {
    return undefined;
  }
  return only;
}
