/** Protected API access requires a verified active user and one unambiguous active organisation membership. */
export function mayAccessProtectedRoute(user: {
  status: string;
  emailVerified: boolean;
  organizationMembers: readonly { id: string; organizationId: string; role: string; status: string }[];
} | null): boolean {
  if (!user || user.status !== 'ACTIVE' || user.emailVerified !== true) return false;
  if (!Array.isArray(user.organizationMembers) || user.organizationMembers.length !== 1) return false;
  const member = user.organizationMembers[0];
  return member?.status === 'ACTIVE'
    && typeof member.id === 'string' && member.id.trim().length > 0
    && typeof member.organizationId === 'string' && member.organizationId.trim().length > 0
    && typeof member.role === 'string' && member.role.trim().length > 0;
}
