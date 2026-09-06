'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    organizationName: '',
    organizationType: 'BUYER',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Unable to create account');
      window.localStorage.setItem('dira_access_token', body.accessToken);
      window.localStorage.setItem('dira_refresh_token', body.refreshToken);
      router.push('/');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Unable to create account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy text-2xl font-bold text-white">d</div>
          <div className="text-2xl font-bold text-navy">dira</div>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome to Dira</h1>
        <p className="mt-2 text-sm text-slate-600">Create your procurement workspace in a minute.</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <input required minLength={2} className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="First name" value={form.firstName} onChange={(event) => update('firstName', event.target.value)} />
            <input required minLength={2} className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Last name" value={form.lastName} onChange={(event) => update('lastName', event.target.value)} />
          </div>
          <input required type="email" className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Work email" value={form.email} onChange={(event) => update('email', event.target.value)} />
          <input required minLength={8} type="password" className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Password (8+ characters)" value={form.password} onChange={(event) => update('password', event.target.value)} />
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="Organization name (optional)" value={form.organizationName} onChange={(event) => update('organizationName', event.target.value)} />
          <div>
            <label htmlFor="organizationType" className="mb-2 block text-sm font-medium text-slate-700">I am joining as</label>
            <select id="organizationType" className="w-full rounded-xl border border-slate-200 px-3 py-2" value={form.organizationType} onChange={(event) => update('organizationType', event.target.value)}>
              <option value="BUYER">Buyer organization</option>
              <option value="SUPPLIER">Supplier organization</option>
              <option value="BOTH">Buyer and supplier</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="w-full rounded-xl bg-navy px-4 py-3 font-medium text-white disabled:opacity-60">
            {loading ? 'Creating workspace...' : 'Create account'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account? <Link href="/login" className="font-semibold text-navy underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
