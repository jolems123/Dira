import { describe, expect, it } from 'vitest';
import { isCanonicalAuthIdentity } from './canonical-auth-identity';

describe('canonical authenticated identity', () => {
  it('accepts canonical nonempty identifiers', () => {
    expect(isCanonicalAuthIdentity('org_123')).toBe(true);
    expect(isCanonicalAuthIdentity('user-123')).toBe(true);
  });
  it.each([undefined, null, '', ' ', ' user', 'user ', 'user\\nother', 'user\\u0000other', 'user\\u007fother'])('rejects malformed identifiers: %s', (value) => {
    expect(isCanonicalAuthIdentity(value)).toBe(false);
  });
});
