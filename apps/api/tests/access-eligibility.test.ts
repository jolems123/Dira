import { describe, expect, it } from 'vitest';
import { mayAccessProtectedRoute } from '../src/lib/access-eligibility';

describe('protected route access eligibility', () => {
  const membership = [{ id: 'membership', organizationId: 'org', role: 'OWNER', status: 'ACTIVE' }];
  it('rejects unverified, missing-flag and inactive accounts', () => {
    expect(mayAccessProtectedRoute({ status: 'ACTIVE', emailVerified: false, organizationMembers: membership })).toBe(false);
    expect(mayAccessProtectedRoute({ status: 'ACTIVE', organizationMembers: membership } as never)).toBe(false);
    expect(mayAccessProtectedRoute({ status: 'SUSPENDED', emailVerified: true, organizationMembers: membership })).toBe(false);
    expect(mayAccessProtectedRoute(null)).toBe(false);
  });
  it('rejects absent, ambiguous or malformed active memberships', () => {
    expect(mayAccessProtectedRoute({ status: 'ACTIVE', emailVerified: true, organizationMembers: [] })).toBe(false);
    expect(mayAccessProtectedRoute({ status: 'ACTIVE', emailVerified: true, organizationMembers: [...membership, ...membership] })).toBe(false);
    expect(mayAccessProtectedRoute({ status: 'ACTIVE', emailVerified: true, organizationMembers: [{ id: 'm', organizationId: ' ', role: 'OWNER', status: 'ACTIVE' }] })).toBe(false);
  });
  it('permits a verified active user with one valid active membership', () => {
    expect(mayAccessProtectedRoute({ status: 'ACTIVE', emailVerified: true, organizationMembers: membership })).toBe(true);
  });
});
