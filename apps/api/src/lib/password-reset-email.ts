type Fetcher = typeof fetch;

export async function sendPasswordResetEmail(args: {
  token: string;
  email: string;
  webOrigin: string;
  apiKey: string;
  from: string;
  fetcher?: Fetcher;
}): Promise<void> {
  const { token, email, webOrigin, apiKey, from, fetcher = fetch } = args;
  if (!apiKey || !from) throw new Error('Password reset email configuration missing');
  const origin = new URL(webOrigin);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') {
    throw new Error('Password reset email configuration invalid');
  }
  const url = new URL('/reset-password', origin);
  url.searchParams.set('token', token);
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Reset your Dira password',
      text: `A password reset was requested for your Dira account. Open this link within 30 minutes: ${url.toString()}\n\nIf you did not request this, ignore this email.`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Password reset email delivery failed');
}
