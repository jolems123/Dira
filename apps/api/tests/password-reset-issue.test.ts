import { describe, expect, it, vi } from 'vitest';
import { issuePasswordResetAtomically } from '../src/lib/password-reset-issue';

describe('atomic password-reset issuance', () => {
  const now = new Date('2026-11-17T06:00:00Z');
  function database(latest: Date | null) {
    const calls: string[] = [];
    const tx = {
      $queryRaw: vi.fn(async () => { calls.push('lock'); return [{ id: 'user-1' }]; }),
      passwordResetToken: {
        findFirst: vi.fn(async () => { calls.push('read'); return latest ? { createdAt: latest } : null; }),
        deleteMany: vi.fn(async () => { calls.push('delete'); return { count: 1 }; }),
        create: vi.fn(async () => { calls.push('create'); return { id: 'reset-1' }; }),
      },
    };
    return { db: { $transaction: async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx) }, tx, calls };
  }

  it('locks the account before checking the cooldown and issuing a token', async () => {
    const { db, calls, tx } = database(null);
    const token = await issuePasswordResetAtomically(db, 'user-1', now);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(calls).toEqual(['lock', 'read', 'delete', 'create']);
    expect(tx.passwordResetToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'user-1', expiresAt: new Date(now.getTime() + 30 * 60_000) }),
    }));
  });

  it('does not replace a link during cooldown', async () => {
    const { db, calls } = database(new Date(now.getTime() - 10_000));
    expect(await issuePasswordResetAtomically(db, 'user-1', now)).toBeNull();
    expect(calls).toEqual(['lock', 'read']);
  });

  it('does not issue a token when the account lock cannot be acquired', async () => {
    const { db, tx } = database(null);
    tx.$queryRaw.mockResolvedValueOnce([]);
    await expect(issuePasswordResetAtomically(db, 'missing', now)).rejects.toThrow('Reset account unavailable');
    expect(tx.passwordResetToken.create).not.toHaveBeenCalled();
  });
});
