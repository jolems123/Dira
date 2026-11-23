import { describe, expect, it, vi } from 'vitest';
import { issueEmailVerificationAtomically } from '../src/lib/email-verification-issue';

describe('email verification issuance', () => {
  it('stores only a hash with one-hour expiry and removes prior unused tokens', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn().mockResolvedValue({});
    const db = { $transaction: async (fn: any) => fn({
      $queryRaw: async () => [{ id: 'user-1' }],
      user: { findUnique: async () => ({ status: 'PENDING_VERIFICATION', emailVerified: false }) },
      emailVerificationToken: { deleteMany, create },
    }) };
    const now = new Date('2026-11-19T08:00:00Z');
    const token = await issueEmailVerificationAtomically(db as any, 'user-1', now);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1', usedAt: null } });
    const data = create.mock.calls[0][0].data;
    expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(data.tokenHash).not.toBe(token);
    expect(data.expiresAt.toISOString()).toBe('2026-11-19T09:00:00.000Z');
    expect(JSON.stringify(data)).not.toContain(token);
  });

  it('does not issue tokens for active or missing accounts', async () => {
    const create = vi.fn();
    for (const user of [{ status: 'ACTIVE', emailVerified: true }, null]) {
      const db = { $transaction: async (fn: any) => fn({
        $queryRaw: async () => [{ id: 'u' }],
        user: { findUnique: async () => user },
        emailVerificationToken: { create },
      }) };
      expect(await issueEmailVerificationAtomically(db as any, 'u', new Date())).toBeNull();
    }
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects blank account identifiers without opening a transaction', async () => {
    const transaction = vi.fn();
    await expect(issueEmailVerificationAtomically({ $transaction: transaction } as any, '  ', new Date())).rejects.toThrow('Invalid account identifier');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects invalid time before any database write', async () => {
    const transaction = vi.fn();
    await expect(issueEmailVerificationAtomically({ $transaction: transaction } as any, 'u', new Date(NaN))).rejects.toThrow('Invalid issuance time');
    expect(transaction).not.toHaveBeenCalled();
  });
});
