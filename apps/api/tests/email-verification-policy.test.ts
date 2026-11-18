import { describe, expect, it } from 'vitest';
import { mayIssueAuthenticatedSession } from '../src/lib/email-verification-policy';

describe('email verification session policy', () => {
  it('rejects unverified active users', () => {
    expect(mayIssueAuthenticatedSession({ status: 'ACTIVE', emailVerified: false })).toBe(false);
  });
  it('rejects suspended and pending accounts even if marked verified', () => {
    expect(mayIssueAuthenticatedSession({ status: 'SUSPENDED', emailVerified: true })).toBe(false);
    expect(mayIssueAuthenticatedSession({ status: 'PENDING_VERIFICATION', emailVerified: true })).toBe(false);
  });
  it('rejects missing or malformed account data', () => {
    expect(mayIssueAuthenticatedSession(null)).toBe(false);
    expect(mayIssueAuthenticatedSession({ status: 'ACTIVE' } as never)).toBe(false);
    expect(mayIssueAuthenticatedSession({ status: 'ACTIVE', emailVerified: 'true' } as never)).toBe(false);
  });
  it('permits only active verified accounts', () => {
    expect(mayIssueAuthenticatedSession({ status: 'ACTIVE', emailVerified: true })).toBe(true);
  });
});
