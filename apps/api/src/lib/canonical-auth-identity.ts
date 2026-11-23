/** Reject malformed tenant/user IDs before role-protected handlers run. */
export function isCanonicalAuthIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
    && !/[\u0000-\u001f\u007f\p{Cf}]/u.test(value);
}

/** Validate the complete authenticated tenant context before exposing protected routes. */
export function isCanonicalAuthContext(value: {
  id?: unknown; organizationId?: unknown; role?: unknown;
} | null | undefined): boolean {
  return !!value && isCanonicalAuthIdentity(value.id)
    && isCanonicalAuthIdentity(value.organizationId)
    && isCanonicalAuthIdentity(value.role);
}
