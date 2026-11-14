/** Deterministic active membership selection for legacy single-organisation sessions.
 * Future multi-organisation switching must use an explicit, verified organisation context.
 */
export function selectActiveMembership<T extends { organizationId: string; status: string; createdAt: Date }>(
  memberships: readonly T[],
): T | undefined {
  return memberships
    .filter((membership) => membership.status === 'ACTIVE')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      || a.organizationId.localeCompare(b.organizationId))[0];
}
