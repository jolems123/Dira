import assert from 'node:assert/strict';
import test from 'node:test';
import { isEmailVerificationCredentialCurrent } from '../src/lib/email-verification-credential';

test('verification credential rejects malformed expiry dates', () => {
  assert.equal(isEmailVerificationCredentialCurrent(new Date(NaN), null, new Date()), false);
});

test('verification credential rejects invalid current clock', () => {
  assert.equal(isEmailVerificationCredentialCurrent(new Date('2026-11-20T00:00:00Z'), null, new Date(NaN)), false);
});

test('verification credential expires exactly at its deadline and rejects reuse', () => {
  const expiry = new Date('2026-11-20T00:00:00Z');
  assert.equal(isEmailVerificationCredentialCurrent(expiry, null, expiry), false);
  assert.equal(isEmailVerificationCredentialCurrent(expiry, new Date('2026-11-19T00:00:00Z'), new Date('2026-11-19T01:00:00Z')), false);
});
