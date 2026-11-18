import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('../src/routes/auth.ts', import.meta.url)), 'utf8');

describe('login email verification enforcement', () => {
  it('checks verified email before creating a refresh token or signing in', () => {
    const login = source.split("authRouter.post('/login'")[1]?.split("authRouter.post('/refresh'")[0] ?? '';
    expect(login).toContain("user.emailVerified !== true");
    expect(login.indexOf('user.emailVerified !== true')).toBeGreaterThan(-1);
    expect(login.indexOf('user.emailVerified !== true')).toBeLessThan(login.indexOf('const issued = tokens(user.id)'));
  });
});
