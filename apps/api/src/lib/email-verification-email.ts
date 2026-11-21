import { validEmailVerificationToken } from './email-verification-token';

type Fetcher = typeof fetch;

/** Delivers a one-time verification URL; never include credentials in logs or API responses. */
export async function sendEmailVerificationEmail(args: {
  token: string;
  email: string;
  webOrigin: string;
  apiKey: string;
  from: string;
  fetcher?: Fetcher;
}): Promise<void> {
  const { token, email, webOrigin, apiKey, from, fetcher = fetch } = args;
  if (!validEmailVerificationToken(token)) throw new Error('Invalid verification credential');
  if (!apiKey || !from) throw new Error('Verification email configuration missing');
  const origin = new URL(webOrigin);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') {
    throw new Error('Verification email configuration invalid');
  }
  const url = new URL('/verify-email', origin);
  url.searchParams.set('token', token);
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Verify your Dira email',
      text: `Confirm your Dira email address within one hour: ${url.toString()}\n\nIf you did not register, ignore this email.`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Verification email delivery failed');
}
