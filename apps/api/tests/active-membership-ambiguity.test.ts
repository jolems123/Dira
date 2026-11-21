import assert from 'node:assert/strict';
import test from 'node:test';
import { selectActiveMembership } from '../src/lib/active-membership';

const member = (organizationId: string, status = 'ACTIVE') => ({ organizationId, status, createdAt: new Date('2026-01-01T00:00:00Z'), role: 'BUYER' });

test('refuses to silently choose an organisation for a multi-tenant user', () => {
  assert.equal(selectActiveMembership([member('org-a'), member('org-b')]), undefined);
});

test('accepts a unique active organisation and ignores inactive memberships', () => {
  assert.equal(selectActiveMembership([member('org-a', 'INACTIVE'), member('org-b')])?.organizationId, 'org-b');
});

test('rejects conflicting active memberships within the same organisation', () => {
  assert.equal(selectActiveMembership([member('org-a'), member('org-a')]), undefined);
});

test('rejects malformed membership timestamps', () => {
  assert.equal(selectActiveMembership([{ ...member('org-a'), createdAt: new Date(NaN) }]), undefined);
});
