import { describe, expect, it } from 'vitest';
import { mayResendVerification } from '../src/lib/email-verification-resend-policy';

describe('email verification resend policy', () => {
  const now = new Date('2026-11-19T12:00:00Z');
  it('only allows pending, unverified accounts', () => {
    expect(mayResendVerification({ status: 'ACTIVE', emailVerified: true }, null, now)).toBe(false);
    expect(mayResendVerification({ status: 'SUSPENDED', emailVerified: false }, null, now)).toBe(false);
    expect(mayResendVerification({ status: 'PENDING_VERIFICATION', emailVerified: false }, null, now)).toBe(true);
  });
  it('enforces cooldown even when an earlier token is used or expired', () => {
    const account = { status: 'PENDING_VERIFICATION', emailVerified: false };
    expect(mayResendVerification(account, new Date(now.getTime() - 29_999), now)).toBe(false);
    expect(mayResendVerification(account, new Date(now.getTime() - 30_000), now)).toBe(true);
  });
  it('fails closed on invalid or future timestamps', () => {
    const account = { status: 'PENDING_VERIFICATION', emailVerified: false };
    expect(mayResendVerification(account, new Date('invalid'), now)).toBe(false);
    expect(mayResendVerification(account, new Date(now.getTime() + 1), now)).toBe(false);
    expect(mayResendVerification(account, null, new Date('invalid'))).toBe(false);
  });
});
