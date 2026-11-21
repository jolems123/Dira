import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Route-level regression guard: database failures must reach Express error middleware.
const source = readFileSync(fileURLToPath(new URL('../src/routes/auth.ts', import.meta.url)), 'utf8');

describe('account profile error handling', () => {
  it('forwards unexpected /me lookup failures to Express error handling', () => {
    const profile = source.match(/authRouter\.get\('\/me'[\s\S]*?(?=authRouter\.post\('\/forgot-password')/);
    expect(profile).not.toBeNull();
    expect(profile?.[0]).toMatch(/async \(req: AuthenticatedRequest, res, next\)/);
    expect(profile?.[0]).toMatch(/catch \(error\) \{\s*return next\(error\);/);
  });
});
