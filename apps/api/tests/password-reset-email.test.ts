import { describe, expect, it, vi } from 'vitest';
import { sendPasswordResetEmail } from '../src/lib/password-reset-email';

describe('password recovery email', () => {
  it('rejects missing production mail configuration without exposing the token', async () => {
    await expect(sendPasswordResetEmail({ token: 'secret', email: 'person@example.org', webOrigin: 'https://dira.example', apiKey: '', from: '' })).rejects.toThrow(/email configuration/i);
  });
  it('uses an encoded token and approved web origin', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    await sendPasswordResetEmail({ token: 'a+b&c', email: 'person@example.org', webOrigin: 'https://dira.example', apiKey: 'test-key', from: 'Dira <noreply@example.org>', fetcher });
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    const body = JSON.parse(options.body);
    expect(body.to).toEqual(['person@example.org']);
    expect(body.text).toContain('https://dira.example/reset-password?token=a%2Bb%26c');
    expect(options.headers.Authorization).toBe('Bearer test-key');
  });
  it('rejects provider failures', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(sendPasswordResetEmail({ token: 'abc', email: 'person@example.org', webOrigin: 'https://dira.example', apiKey: 'test-key', from: 'noreply@example.org', fetcher })).rejects.toThrow(/delivery failed/i);
  });
});
