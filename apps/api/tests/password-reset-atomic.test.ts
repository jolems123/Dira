import { describe, expect, it, vi } from 'vitest';
import { consumeResetToken } from '../src/lib/password-reset';

describe('single-use password reset', () => {
  it('refuses a token already consumed by another request', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const update = vi.fn();
    const revoke = vi.fn();
    await expect(consumeResetToken({ passwordResetToken: { updateMany }, user: { update }, refreshToken: { updateMany: revoke } }, {
      id: 'reset-1', userId: 'user-1', passwordHash: 'hashed', now: new Date('2026-11-09T00:00:00Z'),
    })).resolves.toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
  });
  it('updates password and revokes sessions only after atomic token claim', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const update = vi.fn().mockResolvedValue({});
    const revoke = vi.fn().mockResolvedValue({ count: 2 });
    const now = new Date('2026-11-09T00:00:00Z');
    await expect(consumeResetToken({ passwordResetToken: { updateMany }, user: { update }, refreshToken: { updateMany: revoke } }, {
      id: 'reset-1', userId: 'user-1', passwordHash: 'hashed', now,
    })).resolves.toBe(true);
    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'reset-1', usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    expect(update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { passwordHash: 'hashed' } });
    expect(revoke).toHaveBeenCalledOnce();
  });
});
