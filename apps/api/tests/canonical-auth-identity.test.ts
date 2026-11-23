import { describe, expect, it } from 'vitest';
import { isCanonicalAuthIdentity } from '../src/lib/canonical-auth-identity';

describe('canonical authenticated identities', () => {
  it('accepts ordinary opaque identifiers', () => {
    expect(isCanonicalAuthIdentity('user_123-ABC')).toBe(true);
  });

  it('rejects empty and padded identifiers', () => {
    for (const value of ['', ' ', ' user', 'user ', null, undefined]) {
      expect(isCanonicalAuthIdentity(value)).toBe(false);
    }
  });

  it('rejects ASCII control characters without rejecting ordinary letters', () => {
    for (const code of [0, 1, 9, 10, 13, 31, 127]) {
      expect(isCanonicalAuthIdentity('user' + String.fromCharCode(code) + 'id')).toBe(false);
    }
    expect(isCanonicalAuthIdentity('uuid-abcdef012345')).toBe(true);
  });
});
