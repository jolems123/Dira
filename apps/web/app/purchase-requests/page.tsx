'use client';

import { useEffect, useState } from 'react';
import { getToken } from '../../lib/api';

type PurchaseRequest = {
  id: string;
  requestNumber: string;
  title: string;
  status: string;
  department?: string | null;
  estimatedBudget?: number | null;
  currency?: string | null;
};

export default function PurchaseRequestsPage() {
  const [items, setItems] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  async function loadRequests() {
    const token = getToken();
    if (!token) {
      setError('Sign in to load purchase requests.');
      setLoading(false);
      return;
    }

    const response = await fetch(`${apiUrl}/api/v1/purchase-requests`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Unable to load purchase requests');
    const body = await response.json();
    setItems(body.items ?? []);
  }

  async function runAction(id: string, action: 'submit' | 'approve') {
    const token = getToken();
    if (!token) {
      setError('Sign in to continue.');
      return;
    }

    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/api/v1/purchase-requests/${id}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const body = await response.json().catch(() => undefined);
      if (!response.ok) throw new Error(body?.message ?? `Unable to ${action} purchase request`);
      await loadRequests();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : `Unable to ${action} purchase request`);
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    loadRequests()
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Unable to load purchase requests');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="p-8"><h1 className="text-3xl font-bold text-slate-900">Purchase Requests</h1><div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-slate-500">Loading purchase requests...</div></main>;

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold text-slate-900">Purchase Requests</h1>
      {error && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.length === 0 ? (
          <div className="card p-6 text-slate-500 md:col-span-2 xl:col-span-3">No purchase requests yet. Create your first request to start the workflow.</div>
        ) : items.map((item) => (
          <div key={item.id} className="card p-5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">{item.requestNumber}</span>
              <span className="badge bg-slate-100 text-slate-700">{item.status}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{item.title}</p>
            <div className="mt-3 text-xs text-slate-500">
              <div>{item.department ?? 'Operations'}</div>
              <div>{item.estimatedBudget ? `${item.currency ?? 'BWP'} ${item.estimatedBudget}` : 'Budget pending'}</div>
            </div>
            <div className="mt-4 flex gap-2">
              {item.status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={() => runAction(item.id, 'submit')}
                  disabled={busyId === item.id}
                  className="rounded-lg bg-navy px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                >
                  {busyId === item.id ? 'Submitting...' : 'Submit'}
                </button>
              )}
              {item.status === 'SUBMITTED' && (
                <button
                  type="button"
                  onClick={() => runAction(item.id, 'approve')}
                  disabled={busyId === item.id}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                >
                  {busyId === item.id ? 'Approving...' : 'Approve'}
                </button>
              )}
              {item.status === 'APPROVED' && (
                <span className="rounded-lg bg-emerald-100 px-3 py-2 text-xs font-medium text-emerald-800">
                  Ready for RFQ
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
