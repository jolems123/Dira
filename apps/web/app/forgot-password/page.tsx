'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ email }),
      });
    } catch {
      // Do not disclose whether the account exists or whether mail delivery succeeded.
    } finally { setDone(true); setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
    <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-soft">
      <h1 className="text-2xl font-bold text-navy">Forgot your password?</h1>
      {done ? <p role="status" className="mt-4">If an active account exists for that email, reset instructions will be sent. Check your inbox.</p> :
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm">Email address
            <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border p-3" />
          </label>
          <button disabled={busy} className="w-full rounded-xl bg-navy px-4 py-3 text-white disabled:opacity-50">{busy ? 'Submitting…' : 'Send reset instructions'}</button>
        </form>}
      <Link href="/login" className="mt-5 inline-block text-sm underline">Return to sign in</Link>
    </section>
  </main>;
}
