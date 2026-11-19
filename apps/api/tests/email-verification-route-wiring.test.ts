import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/routes/auth.ts', import.meta.url), 'utf8');
const verify = source.split("authRouter.post('/verify-email'")[1]?.split("authRouter.post('/login'")[0] ?? '';

test('verification endpoint validates token before database lookup', () => {
  assert.match(verify, /verifyEmailSchema\.safeParse\(req\.body\)/);
  assert.match(verify, /emailVerificationToken\.findUnique/);
});
test('verification endpoint consumes token in one transaction and returns no bearer credentials', () => {
  assert.match(verify, /prisma\.\$transaction/);
  assert.match(verify, /consumeEmailVerificationToken/);
  assert.doesNotMatch(verify, /setRefreshCookie\(|accessToken|refreshToken\.create/);
});
test('verification endpoint returns generic invalid-token error on replay or expiry', () => {
  assert.match(verify, /if \(!record \|\| record\.usedAt \|\| record\.expiresAt <= new Date\(\)\)/);
  assert.match(verify, /if \(!consumed\)/);
});
