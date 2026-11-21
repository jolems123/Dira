'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function ResetPasswordForm() {
  const search = useSearchParams();
  const token = search.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (!/^[a-f0-9]{64}$/i.test(token)) { setError('This reset link is invalid. Request another link.'); return; }
    if (password.length < 8 || password.length > 128) { setError('Use a password between 8 and 128 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ token, password }),
      });
      if (!response.ok) { setError('This link is invalid or expired, or the password could not be changed. Request a new link.'); return; }
      setComplete(true);
      setPassword('');
      setConfirm('');
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
    <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-soft">
      <h1 className="text-2xl font-bold text-navy">Reset your Dira password</h1>
      {complete ? <p role="status" className="mt-4">Your password was updated. <Link className="underline" href="/login">Sign in</Link>.</p> :
        <form onSubmit={submit} className="mt-6 space-y-4">
          {!token && <p role="alert" className="text-red-700">Missing reset link token. Request a new link.</p>}
          <label className="block text-sm">New password
            <input aria-label="New password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border p-3" />
          </label>
          <label className="block text-sm">Confirm password
            <input aria-label="Confirm password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-1 w-full rounded-xl border p-3" />
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button disabled={busy || !token} className="w-full rounded-xl bg-navy px-4 py-3 text-white disabled:opacity-50">{busy ? 'Updating…' : 'Update password'}</button>
        </form>}
      <Link href="/forgot-password" className="mt-5 inline-block text-sm underline">Request a new reset link</Link>
    </section>
  </main>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="p-8">Loading password reset…</main>}><ResetPasswordForm /></Suspense>;
}
