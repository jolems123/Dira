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

// Regression guard: delivery failure must revoke the hash of the token just issued.
// The auth route previously referenced an undefined `tokenHash` identifier here.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

it('wires delivery failure cleanup to the issued reset token hash', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const auth = readFileSync(resolve(here, '../src/routes/auth.ts'), 'utf8');
  expect(auth).toMatch(/revokeUndeliveredResetToken\(prisma,\s*hashToken\(resetToken\),\s*new Date\(\)\)/);
});
