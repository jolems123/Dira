import { describe, expect, it } from 'vitest';
import { selectActiveMembership } from '../src/lib/active-membership';

describe('active organisation selection without a tenant-bound token', () => {
  const membership = (organizationId: string, status = 'ACTIVE', createdAt = new Date('2021-01-01')) =>
    ({ organizationId, role: 'BUYER', status, createdAt });

  it('uses the sole active membership and ignores suspended memberships', () => {
    expect(selectActiveMembership([membership('old', 'SUSPENDED'), membership('current')])?.organizationId).toBe('current');
  });

  it('rejects absent active memberships', () => {
    expect(selectActiveMembership([membership('x', 'INVITED')])).toBeUndefined();
    expect(selectActiveMembership([])).toBeUndefined();
  });

  it('fails closed for multiple active organisations regardless of order', () => {
    const memberships = [membership('a'), membership('b')];
    expect(selectActiveMembership(memberships)).toBeUndefined();
    expect(selectActiveMembership([...memberships].reverse())).toBeUndefined();
  });

  it('rejects organisation IDs with surrounding whitespace rather than using an ambiguous tenant key', () => {
    expect(selectActiveMembership([membership(' org-a')])).toBeUndefined();
    expect(selectActiveMembership([membership('org-a ')] )).toBeUndefined();
  });

  it('rejects malformed sole active membership metadata', () => {
    expect(selectActiveMembership([membership('')])).toBeUndefined();
    expect(selectActiveMembership([membership('x', 'ACTIVE', new Date(NaN))])).toBeUndefined();
  });
});
