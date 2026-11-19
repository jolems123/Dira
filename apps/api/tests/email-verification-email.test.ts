import assert from 'node:assert/strict';
import test from 'node:test';
import { sendEmailVerificationEmail } from '../src/lib/email-verification-email';

const token = 'a'.repeat(64);
const origin = 'https://dira.example';

test('sends a verification link only through the configured email provider', async () => {
  let sent: any;
  const fetcher = async (url: any, init: any) => {
    sent = { url, init };
    return { ok: true };
  };
  await sendEmailVerificationEmail({ token, email: 'buyer@example.com', webOrigin: origin, apiKey: 'test-key', from: 'verify@example.com', fetcher: fetcher as any });
  assert.equal(sent.url, 'https://api.resend.com/emails');
  const payload = JSON.parse(sent.init.body);
  const link = payload.text.match(/https:\/\/[^\s]+/)?.[0];
  assert.ok(link);
  assert.equal(new URL(link).pathname, '/verify-email');
  assert.equal(new URL(link).searchParams.get('token'), token);
  assert.ok(!JSON.stringify(payload).includes('test-key'));
});

test('rejects invalid verification token before network request', async () => {
  await assert.rejects(sendEmailVerificationEmail({ token: 'bad', email: 'buyer@example.com', webOrigin: origin, apiKey: 'key', from: 'verify@example.com', fetcher: (async () => { throw Error('network called'); }) as any }));
});

test('rejects insecure and credential-bearing origins', async () => {
  for (const webOrigin of ['http://dira.example', 'https://user:pass@dira.example', 'https://dira.example/path', 'https://dira.example/?x=1']) {
    await assert.rejects(sendEmailVerificationEmail({ token, email: 'buyer@example.com', webOrigin, apiKey: 'key', from: 'verify@example.com' }));
  }
});

test('fails closed on missing email configuration or provider failure', async () => {
  await assert.rejects(sendEmailVerificationEmail({ token, email: 'buyer@example.com', webOrigin: origin, apiKey: '', from: 'verify@example.com' }));
  await assert.rejects(sendEmailVerificationEmail({ token, email: 'buyer@example.com', webOrigin: origin, apiKey: 'key', from: 'verify@example.com', fetcher: (async () => ({ ok: false })) as any }));
});
