import { describe, expect, it } from 'vitest';
import { selectActiveMembership } from '../src/lib/active-membership';

describe('active organisation selection', () => {
  it('never selects an inactive membership even if it is first', () => {
    expect(selectActiveMembership([
      { organizationId: 'old', role: 'OWNER', status: 'SUSPENDED', createdAt: new Date('2020-01-01') },
      { organizationId: 'current', role: 'BUYER', status: 'ACTIVE', createdAt: new Date('2021-01-01') },
    ])?.organizationId).toBe('current');
  });
  it('returns no membership when none is active', () => {
    expect(selectActiveMembership([{ organizationId: 'x', role: 'OWNER', status: 'INVITED', createdAt: new Date() }])).toBeUndefined();
  });
  it('selects deterministically by creation time and id', () => {
    const memberships = [
      { organizationId: 'b', role: 'BUYER', status: 'ACTIVE', createdAt: new Date('2021-01-01') },
      { organizationId: 'a', role: 'OWNER', status: 'ACTIVE', createdAt: new Date('2021-01-01') },
    ];
    expect(selectActiveMembership(memberships)?.organizationId).toBe('a');
    expect(selectActiveMembership([...memberships].reverse())?.organizationId).toBe('a');
  });
});
