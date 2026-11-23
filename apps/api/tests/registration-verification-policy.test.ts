import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/routes/auth.ts', import.meta.url), 'utf8');
const registration = source.split("authRouter.post('/register'")[1]?.split("authRouter.post('/login'")[0] ?? '';

test('registration stores an unverified pending user', () => {
  assert.match(registration, /status:\s*'PENDING_VERIFICATION',\s*emailVerified:\s*false/);
});

test('registration cannot issue an access or refresh session', () => {
  assert.doesNotMatch(registration, /tokens\(result\.user\.id\)/);
  assert.doesNotMatch(registration, /refreshToken\.create/);
  assert.doesNotMatch(registration, /setRefreshCookie\(/);
  assert.doesNotMatch(registration, /accessToken:\s*issued\.accessToken/);
});
