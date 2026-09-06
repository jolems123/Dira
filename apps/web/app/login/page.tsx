'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Unable to sign in');
      window.localStorage.setItem('dira_access_token', body.accessToken);
      window.localStorage.setItem('dira_refresh_token', body.refreshToken);
      router.push('/');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy text-2xl font-bold text-white">d</div>
          <div className="text-2xl font-bold text-navy">dira</div>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-600">Sign into your procurement workspace.</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <input required className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input required minLength={8} className="w-full rounded-xl border border-slate-200 px-3 py-2" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="w-full rounded-xl bg-navy px-4 py-3 font-medium text-white disabled:opacity-60">{loading ? 'Signing in...' : 'Sign in'}</button>
        </form>
      </div>
    </main>
  );
}
