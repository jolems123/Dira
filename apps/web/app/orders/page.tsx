'use client';

import { useEffect, useState } from 'react';

type PurchaseOrder = {
  id: string;
  poNumber: string;
  status: string;
  total?: number | null;
  currency?: string | null;
  supplierOrganizationId?: string | null;
  issuedAt?: string | null;
};

export default function OrdersPage() {
  const [items, setItems] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  useEffect(() => {
    const token = window.localStorage.getItem('dira_access_token');
    if (!token) {
      setError('Sign in to load orders.');
      setLoading(false);
      return;
    }

    fetch(`${apiUrl}/api/v1/purchase-orders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load purchase orders');
        const body = await response.json();
        setItems(body.items ?? []);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load purchase orders'))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  if (loading) return <main className="p-8"><h1 className="text-3xl font-bold text-slate-900">Orders</h1><div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-slate-500">Loading purchase orders...</div></main>;
  if (error) return <main className="p-8"><h1 className="text-3xl font-bold text-slate-900">Orders</h1><div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div></main>;

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold text-slate-900">Orders</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.length === 0 ? (
          <div className="card p-6 text-slate-500 md:col-span-2 xl:col-span-3">No purchase orders yet. Award a quotation to create the first PO.</div>
        ) : items.map((item) => (
          <div key={item.id} className="card p-5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">{item.poNumber}</span>
              <span className="badge bg-slate-100 text-slate-700">{item.status}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">Supplier ID: {item.supplierOrganizationId ?? 'Pending'}</p>
            <div className="mt-3 text-xs text-slate-500">
              <div>Issued: {item.issuedAt ? new Date(item.issuedAt).toLocaleDateString() : 'Unknown'}</div>
              <div>Total: {item.currency ?? 'BWP'} {item.total ?? 0}</div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
