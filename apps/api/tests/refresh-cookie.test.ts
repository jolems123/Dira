import { describe, expect, it } from 'vitest';
import { parseRefreshCookie } from '../src/lib/refresh-cookie';

describe('refresh cookie parsing', () => {
  it('returns a valid refresh token from cookie header', () => {
    expect(parseRefreshCookie('a=b; dira_refresh_token=abc123; c=d')).toBe('abc123');
  });
  it('rejects malformed percent escapes without throwing', () => {
    expect(parseRefreshCookie('dira_refresh_token=%E0%A4%A')).toBeUndefined();
  });
  it('rejects duplicate refresh cookies', () => {
    expect(parseRefreshCookie('dira_refresh_token=one; dira_refresh_token=two')).toBeUndefined();
  });
  it('rejects empty and oversized credentials', () => {
    expect(parseRefreshCookie('dira_refresh_token=')).toBeUndefined();
    expect(parseRefreshCookie('dira_refresh_token=' + 'x'.repeat(5000))).toBeUndefined();
  });
});
