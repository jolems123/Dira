import { describe, expect, it, vi } from 'vitest';
import { consumeResetToken } from '../src/lib/password-reset';

describe('password reset invalidates other reset links', () => {
  it('consumes all outstanding reset links after a successful password change', async () => {
    const updateMany = vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 2 });
    const userUpdate = vi.fn().mockResolvedValue({});
    const refreshUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const now = new Date('2026-11-16T00:00:00.000Z');
    const result = await consumeResetToken({
      passwordResetToken: { updateMany },
      user: { update: userUpdate },
      refreshToken: { updateMany: refreshUpdate },
    }, { id: 'reset-a', userId: 'user-a', passwordHash: 'new-hash', now });
    expect(result).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-a', usedAt: null },
      data: { usedAt: now },
    });
    expect(refreshUpdate).toHaveBeenCalledTimes(1);
  });

  it('does not change password or other tokens when the link was already used', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const userUpdate = vi.fn();
    const refreshUpdate = vi.fn();
    const result = await consumeResetToken({
      passwordResetToken: { updateMany },
      user: { update: userUpdate },
      refreshToken: { updateMany: refreshUpdate },
    }, { id: 'reset-a', userId: 'user-a', passwordHash: 'new-hash', now: new Date() });
    expect(result).toBe(false);
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(userUpdate).not.toHaveBeenCalled();
    expect(refreshUpdate).not.toHaveBeenCalled();
  });
});
