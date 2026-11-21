import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmailVerificationCredential, isEmailVerificationCredentialCurrent } from '../src/lib/email-verification-credential';

test('verification credential is random, opaque, and stores only a SHA-256 digest', () => {
  const first = createEmailVerificationCredential(new Date('2026-11-19T00:00:00Z'));
  const second = createEmailVerificationCredential(new Date('2026-11-19T00:00:00Z'));
  assert.match(first.token, /^[a-f0-9]{64}$/);
  assert.match(first.tokenHash, /^[a-f0-9]{64}$/);
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.tokenHash, second.tokenHash);
  assert.notEqual(first.token, first.tokenHash);
  assert.equal(first.expiresAt.toISOString(), '2026-11-19T01:00:00.000Z');
});

test('credential expires at the boundary and cannot be reused after consumption', () => {
  const issued = createEmailVerificationCredential(new Date('2026-11-19T00:00:00Z'));
  assert.equal(isEmailVerificationCredentialCurrent(issued.expiresAt, null, new Date('2026-11-19T00:59:59Z')), true);
  assert.equal(isEmailVerificationCredentialCurrent(issued.expiresAt, null, issued.expiresAt), false);
  assert.equal(isEmailVerificationCredentialCurrent(issued.expiresAt, new Date('2026-11-19T00:01:00Z'), new Date('2026-11-19T00:02:00Z')), false);
});
