/** Password-reset credentials are 32 random bytes encoded as lowercase hex. */
export function validPasswordResetToken(value: unknown): value is string {
  return typeof value === 'string' && value.length === 64 && /^[0-9a-f]{64}$/.test(value);
}
