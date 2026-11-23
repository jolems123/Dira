import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const middleware = readFileSync(fileURLToPath(new URL('../src/middleware/auth.ts', import.meta.url)), 'utf8');

describe('authentication database failure handling', () => {
  it('does not turn a database outage into an invalid-token response', () => {
    expect(middleware).toMatch(/verifyAccessToken\(token, env\.jwtAccessSecret\)/);
    expect(middleware).toMatch(/catch\s*\(error\)\s*\{\s*return next\(error\);/);
  });
});
