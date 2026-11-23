import { describe, expect, it } from 'vitest';
import { isCanonicalAuthIdentity, isCanonicalAuthContext } from '../src/lib/canonical-auth-identity';

describe('canonical authenticated identities', () => {
  it('accepts ordinary opaque identifiers', () => {
    expect(isCanonicalAuthIdentity('user_123-ABC')).toBe(true);
  });
  it('rejects empty and padded identifiers', () => {
    for (const value of ['', ' ', ' user', 'user ', null, undefined]) expect(isCanonicalAuthIdentity(value)).toBe(false);
  });
  it('rejects ASCII control characters without rejecting ordinary letters', () => {
    for (const code of [0, 1, 9, 10, 13, 31, 127]) expect(isCanonicalAuthIdentity('user' + String.fromCharCode(code) + 'id')).toBe(false);
    expect(isCanonicalAuthIdentity('uuid-abcdef012345')).toBe(true);
  });
  it('rejects malformed role or organisation context before protected operations', () => {
    expect(isCanonicalAuthContext({ id: 'u1', organizationId: 'org1', role: 'BUYER' })).toBe(true);
    for (const bad of [
      { id: 'u1', organizationId: ' org1', role: 'BUYER' },
      { id: 'u1', organizationId: 'org1', role: 'BUYER\nADMIN' },
      { id: 'u1', organizationId: 'org1', role: '' },
      { id: 'u1', organizationId: 'org1', role: ' BUYER' },
      { id: 'u1', organizationId: 'org1', role: 'BUYER\u0000' },
    ]) expect(isCanonicalAuthContext(bad)).toBe(false);
  });
  it('rejects Unicode bidi and invisible format controls in identity and role context', () => {
    for (const marker of ['\u202e', '\u202d', '\u2066', '\u2069', '\u200b', '\ufeff']) {
      expect(isCanonicalAuthIdentity('org' + marker + '1')).toBe(false);
      expect(isCanonicalAuthContext({ id: 'u1', organizationId: 'org1', role: 'BUY' + marker + 'ER' })).toBe(false);
    }
  });

});
