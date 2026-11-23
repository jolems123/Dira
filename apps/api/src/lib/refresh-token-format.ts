/** Generated refresh credentials are 48 random bytes encoded as lowercase hex.
 * Reject malformed and unbounded input before hashing or querying the database.
 */
export function validRefreshToken(value: unknown): value is string {
  return typeof value === 'string' && value.length === 96 && /^[0-9a-f]{96}$/.test(value);
}
