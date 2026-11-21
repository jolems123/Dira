import { describe, expect, it, vi } from 'vitest';
import { revokeUndeliveredResetToken } from '../src/lib/password-reset-delivery';

describe('failed password-reset email cleanup', () => {
  const hash = 'a'.repeat(64);
  const now = new Date('2026-11-18T07:00:00Z');

  it('marks exactly the undelivered credential as used', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    await revokeUndeliveredResetToken({ passwordResetToken: { updateMany } }, hash, now);
    expect(updateMany).toHaveBeenCalledWith({ where: { tokenHash: hash, usedAt: null }, data: { usedAt: now } });
  });

  it('retries transient persistence failures', async () => {
    const updateMany = vi.fn().mockRejectedValueOnce(new Error('temporary database error')).mockResolvedValueOnce({ count: 1 });
    await revokeUndeliveredResetToken({ passwordResetToken: { updateMany } }, hash, now);
    expect(updateMany).toHaveBeenCalledTimes(2);
  });

  it('rejects cleanup when no credential is revoked', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    await expect(revokeUndeliveredResetToken({ passwordResetToken: { updateMany } }, hash, now)).rejects.toThrow('did not revoke');
  });

  it('propagates persistent database failures', async () => {
    const updateMany = vi.fn().mockRejectedValue(new Error('database unavailable'));
    await expect(revokeUndeliveredResetToken({ passwordResetToken: { updateMany } }, hash, now)).rejects.toThrow('database unavailable');
    expect(updateMany).toHaveBeenCalledTimes(3);
  });
});
