/** Reject malformed tenant/user IDs before role-protected handlers run. */
export function isCanonicalAuthIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
    && !/[\\u0000-\\u001f\\u007f]/.test(value);
}
