import { describe, expect, it } from 'vitest';
import { mayRefreshSession } from '../src/lib/refresh-eligibility';

describe('refresh session eligibility', () => {
  it('rejects deleted or inactive users', () => {
    expect(mayRefreshSession(null)).toBe(false);
    expect(mayRefreshSession({ status: 'SUSPENDED', organizationMembers: [{ id: 'member' }] })).toBe(false);
  });
  it('rejects an active user whose memberships have all been revoked', () => {
    expect(mayRefreshSession({ status: 'ACTIVE', organizationMembers: [] })).toBe(false);
  });
  it('permits an active account with an active membership', () => {
    expect(mayRefreshSession({ status: 'ACTIVE', organizationMembers: [{ id: 'member' }] })).toBe(true);
  });
});
