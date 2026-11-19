import { describe, expect, it } from 'vitest';
import { validEmailVerificationToken } from '../src/lib/email-verification-token';

describe('email verification credential format', () => {
  it('accepts a 32-byte lowercase hex credential', () => {
    expect(validEmailVerificationToken('ab'.repeat(32))).toBe(true);
  });
  it('rejects malformed, ambiguous and oversized credentials', () => {
    for (const value of [undefined, null, 1, '', 'a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), 'z'.repeat(64), 'a'.repeat(64) + '\n', 'a'.repeat(100000), '%61'.repeat(22), ['a'.repeat(64)]]) {
      expect(validEmailVerificationToken(value)).toBe(false);
    }
  });
});
