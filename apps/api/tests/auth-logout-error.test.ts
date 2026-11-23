import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('forwards logout database failures to the Express error handler instead of leaving an unhandled rejection', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(resolve(here, '../src/routes/auth.ts'), 'utf8');
  const logout = source.match(/authRouter\.post\('\/logout'[\s\S]*?\n\}\);/);
  expect(logout).not.toBeNull();
  expect(logout?.[0]).toMatch(/async \(req: AuthenticatedRequest, res, next\)/);
  expect(logout?.[0]).toMatch(/catch \(error\) \{\s*return next\(error\);/);
});
