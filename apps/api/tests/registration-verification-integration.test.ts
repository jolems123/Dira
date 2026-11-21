import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const auth = readFileSync(new URL('../src/routes/auth.ts', import.meta.url), 'utf8');

test('registration issues one-time verification credential after creating pending account', () => {
  const register = auth.split("authRouter.post('/register'")[1].split("authRouter.post('/verify-email'")[0];
  assert.match(register, /issueEmailVerificationAtomically\(prisma, result\.user\.id, new Date\(\)\)/);
  assert.match(register, /sendEmailVerificationEmail\(/);
  assert.doesNotMatch(register, /setRefreshCookie\(/);
  assert.doesNotMatch(register, /accessToken:/);
});

test('failed verification delivery revokes the undelivered credential', () => {
  const register = auth.split("authRouter.post('/register'")[1].split("authRouter.post('/verify-email'")[0];
  assert.match(register, /emailVerificationToken\.deleteMany\(/);
  assert.match(register, /tokenHash: hashToken\(verificationToken\)/);
  assert.doesNotMatch(register, /console\.(?:log|error)\([^\n]*verificationToken/);
});
