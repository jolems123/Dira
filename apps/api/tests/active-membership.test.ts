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
  it('rejects missing, blank or whitespace-padded membership roles', () => {
    expect(selectActiveMembership([{ ...membership('org-a'), role: '' }])).toBeUndefined();
    expect(selectActiveMembership([{ ...membership('org-a'), role: ' BUYER' }])).toBeUndefined();
    expect(selectActiveMembership([{ ...membership('org-a'), role: 'BUYER ' }])).toBeUndefined();
    expect(selectActiveMembership([{ ...membership('org-a'), role: null as unknown as string }])).toBeUndefined();
  });

  it('rejects control characters inside tenant IDs and roles', () => {
    expect(selectActiveMembership([membership('org\na')])).toBeUndefined();
    expect(selectActiveMembership([membership('org\u0000a')])).toBeUndefined();
    expect(selectActiveMembership([{ ...membership('org-a'), role: 'BUY\nER' }])).toBeUndefined();
    expect(selectActiveMembership([{ ...membership('org-a'), role: 'BUY\u0000ER' }])).toBeUndefined();
  });
  it('rejects invisible Unicode format controls in organisation and role identifiers', () => {
    expect(selectActiveMembership([membership('org\u202Ea')])).toBeUndefined();
    expect(selectActiveMembership([{ ...membership('org-a'), role: 'BUY\u200BER' }])).toBeUndefined();
  });
  it('rejects Unicode line separators and C1 control characters in tenant and role metadata', () => {
    expect(selectActiveMembership([membership('org\\u0085a')])).toBeUndefined();
    expect(selectActiveMembership([membership('org\\u2028a')])).toBeUndefined();
    expect(selectActiveMembership([{ ...membership('org-a'), role: 'BUY\\u2029ER' }])).toBeUndefined();
  });
});
