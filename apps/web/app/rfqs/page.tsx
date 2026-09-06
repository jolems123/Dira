'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { API_BASE, getToken } from '../../lib/api';

type RFQ = {
  id: string;
  rfqNumber: string;
  title: string;
  status: string;
  quoteDeadline?: string | null;
  budget?: number | null;
  currency?: string | null;
  quoteCount?: number;
};

type ApprovedRequest = {
  id: string;
  requestNumber: string;
  title: string;
  status: string;
};

type Supplier = {
  id: string;
  legalName: string;
  tradingName?: string | null;
};

export default function RFQsPage() {
  const [items, setItems] = useState<RFQ[]>([]);
  const [requests, setRequests] = useState<ApprovedRequest[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [quoteDeadline, setQuoteDeadline] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId),
    [requests, selectedRequestId],
  );

  async function loadData() {
    const token = getToken();
    if (!token) {
      setError('Sign in to load RFQs.');
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };
    const [rfqResponse, requestResponse, supplierResponse] = await Promise.all([
      fetch(`${apiUrl}/api/v1/rfqs`, { headers }),
      fetch(`${apiUrl}/api/v1/purchase-requests`, { headers }),
      fetch(`${apiUrl}/api/v1/suppliers`, { headers }),
    ]);

    if (!rfqResponse.ok) throw new Error('Unable to load RFQs');
    if (!requestResponse.ok) throw new Error('Unable to load purchase requests');
    if (!supplierResponse.ok) throw new Error('Unable to load suppliers');

    const rfqBody = await rfqResponse.json();
    const requestBody = await requestResponse.json();
    const supplierBody = await supplierResponse.json();

    setItems(rfqBody.items ?? []);
    setRequests((requestBody.items ?? []).filter((request: ApprovedRequest) => request.status === 'APPROVED'));
    setSuppliers(supplierBody.items ?? []);
  }

  useEffect(() => {
    loadData()
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load RFQs'))
      .finally(() => setLoading(false));
  }, []);

  async function createRfq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getToken();
    if (!token) {
      setError('Sign in to continue.');
      return;
    }

    if (!selectedRequestId) {
      setError('Select an approved purchase request.');
      return;
    }
    if (selectedSupplierIds.length === 0) {
      setError('Select at least one supplier.');
      return;
    }
    if (!quoteDeadline) {
      setError('Set a quote deadline.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/api/v1/rfqs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          purchaseRequestId: selectedRequestId,
          title: selectedRequest ? `RFQ for ${selectedRequest.requestNumber}` : undefined,
          quoteDeadline: new Date(quoteDeadline).toISOString(),
          supplierIds: selectedSupplierIds,
        }),
      });
      const body = await response.json().catch(() => undefined);
      if (!response.ok) throw new Error(body?.message ?? 'Unable to create RFQ');
      setSelectedRequestId('');
      setSelectedSupplierIds([]);
      setQuoteDeadline('');
      await loadData();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Unable to create RFQ');
    } finally {
      setSubmitting(false);
    }
  }

  async function publishRfq(id: string) {
    const token = getToken();
    if (!token) {
      setError('Sign in to continue.');
      return;
    }

    setPublishingId(id);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/api/v1/rfqs/${id}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => undefined);
      if (!response.ok) throw new Error(body?.message ?? 'Unable to publish RFQ');
      await loadData();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Unable to publish RFQ');
    } finally {
      setPublishingId(null);
    }
  }

  if (loading) return <main className="p-8"><h1 className="text-3xl font-bold text-slate-900">RFQs</h1><div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-slate-500">Loading RFQs...</div></main>;

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold text-slate-900">RFQs</h1>
      {error && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}

      <form className="mt-6 card space-y-4 p-5" onSubmit={createRfq}>
        <h2 className="text-lg font-semibold text-slate-900">Create RFQ from approved request</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-700">
            Purchase request
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={selectedRequestId}
              onChange={(event) => setSelectedRequestId(event.target.value)}
              disabled={submitting}
            >
              <option value="">Select approved request</option>
              {requests.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.requestNumber} - {request.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Quote deadline
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={quoteDeadline}
              onChange={(event) => setQuoteDeadline(event.target.value)}
              disabled={submitting}
            />
          </label>
        </div>
        <div>
          <p className="text-sm text-slate-700">Invite suppliers</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {suppliers.length === 0 ? (
              <p className="text-sm text-slate-500">No suppliers available.</p>
            ) : suppliers.map((supplier) => {
              const checked = selectedSupplierIds.includes(supplier.id);
              return (
                <label key={supplier.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedSupplierIds((current) => checked
                        ? current.filter((id) => id !== supplier.id)
                        : [...current, supplier.id]);
                    }}
                    disabled={submitting}
                  />
                  {supplier.tradingName ?? supplier.legalName}
                </label>
              );
            })}
          </div>
        </div>
        <button type="submit" disabled={submitting} className="rounded-xl bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {submitting ? 'Creating...' : 'Create RFQ'}
        </button>
      </form>

      <div className="mt-6 space-y-4">
        {items.length === 0 ? (
          <div className="card p-6 text-slate-500">No RFQs yet. Approve a purchase request and create an RFQ to begin supplier quoting.</div>
        ) : items.map((item) => (
          <div key={item.id} className="card flex items-center justify-between p-5">
            <div>
              <p className="font-semibold text-slate-900">{item.rfqNumber}</p>
              <p className="text-sm text-slate-600">{item.title}</p>
              <p className="mt-2 text-xs text-slate-500">Quotes received: {item.quoteCount ?? 0}</p>
            </div>
            <div className="text-right text-sm text-slate-500">
              <div className="badge bg-amber-100 text-amber-800">{item.status}</div>
              <div className="mt-2">Deadline: {item.quoteDeadline ? new Date(item.quoteDeadline).toLocaleString() : 'TBD'}</div>
              {item.status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={() => publishRfq(item.id)}
                  disabled={publishingId === item.id}
                  className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                >
                  {publishingId === item.id ? 'Publishing...' : 'Publish'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
