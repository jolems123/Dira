import { describe, expect, it, vi } from 'vitest';
import { revokeUndeliveredResetToken } from '../src/lib/password-reset-delivery';

describe('undelivered password reset cleanup', () => {
  it('revokes only the undelivered token by hash', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    await revokeUndeliveredResetToken({ passwordResetToken: { updateMany } }, 'abc', new Date('2026-11-17T05:00:00Z'));
    expect(updateMany).toHaveBeenCalledWith({ where: { tokenHash: 'abc', usedAt: null }, data: { usedAt: new Date('2026-11-17T05:00:00Z') } });
  });
  it('propagates storage failure for operational alerting', async () => {
    const updateMany = vi.fn().mockRejectedValue(new Error('db unavailable'));
    await expect(revokeUndeliveredResetToken({ passwordResetToken: { updateMany } }, 'abc', new Date())).rejects.toThrow('db unavailable');
  });
});
