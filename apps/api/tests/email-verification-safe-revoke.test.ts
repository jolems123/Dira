import { describe, expect, it, vi } from 'vitest';
import { safelyRevokeUndeliveredVerification } from '../src/lib/email-verification-safe-revoke';

describe('failed verification delivery cleanup', () => {
  it('revokes the exact undelivered credential', async () => {
    const revoke = vi.fn().mockResolvedValue(true);
    const warn = vi.fn();
    expect(await safelyRevokeUndeliveredVerification(revoke, 'user-1', 'a'.repeat(64), warn)).toBe(true);
    expect(revoke).toHaveBeenCalledWith('user-1', 'a'.repeat(64));
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not throw or expose token details when the cleanup database fails', async () => {
    const revoke = vi.fn().mockRejectedValue(new Error('database failure containing sensitive values'));
    const warn = vi.fn();
    expect(await safelyRevokeUndeliveredVerification(revoke, 'user-1', 'b'.repeat(64), warn)).toBe(false);
    expect(warn).toHaveBeenCalledWith('Unable to revoke undelivered verification credential');
  });

  it('reports an unrevoked credential without exposing the hash', async () => {
    const warn = vi.fn();
    expect(await safelyRevokeUndeliveredVerification(vi.fn().mockResolvedValue(false), 'u', 'c'.repeat(64), warn)).toBe(false);
    expect(warn).toHaveBeenCalledWith('Unable to revoke undelivered verification credential');
  });
});
