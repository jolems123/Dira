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
