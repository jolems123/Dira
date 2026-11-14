/** Parse a single refresh cookie without throwing on attacker-controlled input. */
export function parseRefreshCookie(header: string): string | undefined {
  const values = header.split(';').map(part => part.trim()).filter(part => part.startsWith('dira_refresh_token='));
  if (values.length !== 1) return undefined;
  const raw = values[0].slice('dira_refresh_token='.length);
  if (!raw || raw.length > 512) return undefined;
  try {
    const value = decodeURIComponent(raw);
    return value && value.length <= 512 ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Both issuance and removal must use identical cookie scope and security flags. */
export function refreshCookieHeader(token: string, production: boolean): string {
  return `dira_refresh_token=${token}; HttpOnly; Path=/api/v1/auth; Max-Age=604800; SameSite=Lax${production ? '; Secure' : ''}`;
}

export function clearRefreshCookieHeader(production: boolean): string {
  return `dira_refresh_token=; HttpOnly; Path=/api/v1/auth; Max-Age=0; SameSite=Lax${production ? '; Secure' : ''}`;
}
