import { describe, expect, it } from 'vitest';
import { mayIssuePasswordReset } from '../src/lib/password-reset-cooldown';

describe('password reset request cooldown', () => {
  const now = new Date('2026-11-17T05:00:00.000Z');
  it('allows first request', () => expect(mayIssuePasswordReset(null, now)).toBe(true));
  it('rejects a second request within 60 seconds', () => expect(mayIssuePasswordReset({ createdAt: new Date(now.getTime() - 30_000) }, now)).toBe(false));
  it('allows another request after 60 seconds', () => expect(mayIssuePasswordReset({ createdAt: new Date(now.getTime() - 60_000) }, now)).toBe(true));
  it('rejects future timestamps to fail closed on clock skew', () => expect(mayIssuePasswordReset({ createdAt: new Date(now.getTime() + 1000) }, now)).toBe(false));
});
