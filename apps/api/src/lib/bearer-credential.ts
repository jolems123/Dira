/** Accept one unambiguous JWT bearer credential; reject extra header material. */
export function bearerCredential(header: string | undefined): string | undefined {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return undefined;
  const token = header.slice('Bearer '.length);
  // JWTs use base64url segments separated by dots. Never accept whitespace,
  // commas or a second credential from a combined Authorization header.
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) ? token : undefined;
}
