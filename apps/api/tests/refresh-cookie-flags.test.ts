import { describe, expect, it } from 'vitest';
import { refreshCookieHeader, clearRefreshCookieHeader } from '../src/lib/refresh-cookie';

describe('refresh cookie security', () => {
  it('sets secure transport and a scoped HttpOnly cookie in production', () => {
    expect(refreshCookieHeader('abc', true)).toContain('; Secure');
    expect(refreshCookieHeader('abc', true)).toContain('; HttpOnly; Path=/api/v1/auth;');
  });
  it('clears the same scoped secure cookie in production', () => {
    const header = clearRefreshCookieHeader(true);
    expect(header).toContain('Max-Age=0');
    expect(header).toContain('; Secure');
    expect(header).toContain('Path=/api/v1/auth');
  });
  it('never embeds a credential in the clearing header', () => {
    expect(clearRefreshCookieHeader(false)).toMatch(/^dira_refresh_token=;/);
    expect(clearRefreshCookieHeader(false)).not.toContain('; Secure');
  });
});
