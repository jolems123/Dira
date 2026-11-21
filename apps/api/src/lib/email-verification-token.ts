/** Email-verification credentials must be 32 cryptographically random bytes, lowercase hex encoded. */
export function validEmailVerificationToken(value: unknown): value is string {
  return typeof value === 'string' && value.length === 64 && /^[0-9a-f]{64}$/.test(value);
}
