import { describe, expect, it, vi } from 'vitest';
import { revokeUndeliveredVerificationToken } from '../src/lib/email-verification-revoke';

describe('undelivered verification credential revocation', () => {
  it('marks only the matching unused credential as consumed, preserving issuance history for cooldown', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = { emailVerificationToken: { updateMany } };
    const now = new Date('2026-11-19T13:00:00Z');
    await expect(revokeUndeliveredVerificationToken(db as any, 'user-1', 'a'.repeat(64), now)).resolves.toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', tokenHash: 'a'.repeat(64), usedAt: null },
      data: { usedAt: now },
    });
  });
  it('does not revoke a credential already consumed or replaced', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    expect(await revokeUndeliveredVerificationToken({ emailVerificationToken: { updateMany } } as any, 'u', 'b'.repeat(64), new Date())).toBe(false);
  });
  it('rejects invalid clock and digest before a database write', async () => {
    const updateMany = vi.fn();
    const db = { emailVerificationToken: { updateMany } };
    await expect(revokeUndeliveredVerificationToken(db as any, 'u', 'bad', new Date())).rejects.toThrow();
    await expect(revokeUndeliveredVerificationToken(db as any, 'u', 'a'.repeat(64), new Date(NaN))).rejects.toThrow();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
