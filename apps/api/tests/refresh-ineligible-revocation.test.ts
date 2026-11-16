import { describe, expect, it, vi } from 'vitest';
import { revokeIneligibleRefreshSessions } from '../src/lib/refresh-eligibility';

describe('ineligible refresh sessions', () => {
  it('revokes outstanding refresh credentials for an account with no active membership', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    await revokeIneligibleRefreshSessions({ refreshToken: { updateMany } }, 'user-1');
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
  it('propagates database failure instead of claiming revocation succeeded', async () => {
    const updateMany = vi.fn().mockRejectedValue(new Error('database unavailable'));
    await expect(revokeIneligibleRefreshSessions({ refreshToken: { updateMany } }, 'user-1')).rejects.toThrow('database unavailable');
  });
});
