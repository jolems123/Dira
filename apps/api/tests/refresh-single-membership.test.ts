import { describe, expect, it } from 'vitest';
import { mayRefreshSession } from '../src/lib/refresh-eligibility';

describe('refresh eligibility matches single-tenant session selection', () => {
  it('allows one active membership for an active account', () => {
    expect(mayRefreshSession({ status: 'ACTIVE', organizationMembers: [{ id: 'member-1' }] })).toBe(true);
  });
  it('rejects accounts with no active membership', () => {
    expect(mayRefreshSession({ status: 'ACTIVE', organizationMembers: [] })).toBe(false);
  });
  it('rejects ambiguous multi-organisation accounts', () => {
    expect(mayRefreshSession({ status: 'ACTIVE', organizationMembers: [{ id: 'member-1' }, { id: 'member-2' }] })).toBe(false);
  });
  it('rejects inactive and missing accounts', () => {
    expect(mayRefreshSession({ status: 'DISABLED', organizationMembers: [{ id: 'member-1' }] })).toBe(false);
    expect(mayRefreshSession(null)).toBe(false);
  });
});
