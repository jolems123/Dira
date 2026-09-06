'use client';

import { useEffect, useState } from 'react';
import { getToken } from '../../lib/api';

type Supplier = {
  id: string;
  legalName: string;
  tradingName?: string | null;
  city?: string | null;
  country?: string | null;
  verificationStatus?: string | null;
};

export default function SuppliersPage() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError('Sign in to load suppliers.');
      setLoading(false);
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/suppliers`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load suppliers');
        const body = await response.json();
        setItems(body.items ?? []);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load suppliers'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="p-8"><h1 className="text-3xl font-bold text-slate-900">Supplier directory</h1><div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-slate-500">Loading supplier directory...</div></main>;
  if (error) return <main className="p-8"><h1 className="text-3xl font-bold text-slate-900">Supplier directory</h1><div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div></main>;

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold text-slate-900">Supplier directory</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.length === 0 ? (
          <div className="card p-6 text-slate-500 md:col-span-2 xl:col-span-3">No suppliers are currently visible in the directory.</div>
        ) : items.map((supplier) => (
          <div key={supplier.id} className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">{supplier.tradingName ?? supplier.legalName}</h2>
              <span className="badge bg-emerald-100 text-emerald-800">{supplier.verificationStatus ?? 'PENDING'}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{supplier.legalName}</p>
            <p className="mt-1 text-sm text-slate-500">{supplier.city ?? 'Unknown city'}, {supplier.country ?? 'Unknown country'}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
