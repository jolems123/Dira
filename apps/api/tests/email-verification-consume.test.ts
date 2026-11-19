import assert from 'node:assert/strict';
import test from 'node:test';
import { consumeEmailVerificationToken } from '../src/lib/email-verification-consume';

test('claims an unused unexpired credential and verifies its owner', async () => {
  const calls: any[] = [];
  const tx = {
    emailVerificationToken: {
      updateMany: async (args: any) => { calls.push(args); return { count: 1 }; },
    },
    user: {
      updateMany: async (args: any) => { calls.push(args); return { count: 1 }; },
    },
  };
  const now = new Date('2026-11-19T03:00:00Z');
  assert.equal(await consumeEmailVerificationToken(tx, { id: 'token-1', userId: 'user-1', now }), true);
  assert.deepEqual(calls[0].where, { id: 'token-1', userId: 'user-1', usedAt: null, expiresAt: { gt: now } });
  assert.deepEqual(calls[1].where, { id: 'user-1', emailVerified: false });
});

test('replayed or expired credentials cannot verify a user', async () => {
  let updated = false;
  const tx = {
    emailVerificationToken: { updateMany: async () => ({ count: 0 }) },
    user: { updateMany: async () => { updated = true; return { count: 1 }; } },
  };
  assert.equal(await consumeEmailVerificationToken(tx, { id: 'token-1', userId: 'user-1', now: new Date() }), false);
  assert.equal(updated, false);
});

test('invalid clock fails closed without database writes', async () => {
  const tx = {
    emailVerificationToken: { updateMany: async () => { throw Error('unexpected write'); } },
    user: { updateMany: async () => { throw Error('unexpected write'); } },
  };
  assert.equal(await consumeEmailVerificationToken(tx, { id: 't', userId: 'u', now: new Date(NaN) }), false);
});
