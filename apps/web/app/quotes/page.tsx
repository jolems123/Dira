'use client';

import { useEffect, useMemo, useState } from 'react';
import { AttachmentUpload } from '../../components/AttachmentUpload';

type RFQ = {
  id: string;
  rfqNumber: string;
  title: string;
  status: string;
  quoteDeadline?: string | null;
  quoteCount?: number;
};

type Quote = {
  id: string;
  quoteNumber: string;
  status: string;
  total: number;
  currency: string;
  deliveryDays?: number | null;
  paymentTerms?: string | null;
  notes?: string | null;
  createdAt: string;
  organization?: {
    legalName: string;
    tradingName?: string | null;
    city?: string | null;
    country?: string | null;
    verificationStatus?: string | null;
  };
  items?: Array<{ id: string; rfqItemId?: string | null; quantity: number; unitPrice: number; subtotal: number; notes?: string | null }>;
};

export default function QuotesPage() {
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [selectedRfqId, setSelectedRfqId] = useState<string>('');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [awardingId, setAwardingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  const selectedRfq = useMemo(
    () => rfqs.find((rfq) => rfq.id === selectedRfqId) ?? null,
    [rfqs, selectedRfqId],
  );

  useEffect(() => {
    const token = window.localStorage.getItem('dira_access_token');
    if (!token) {
      setError('Sign in to review quotes.');
      setLoading(false);
      return;
    }

    fetch(`${apiUrl}/api/v1/rfqs`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load RFQs');
        const body = await response.json();
        const items = body.items ?? [];
        setRfqs(items);
        if (items.length > 0) {
          setSelectedRfqId(items[0].id);
        }
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load RFQs'))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  useEffect(() => {
    if (!selectedRfqId) {
      setQuotes([]);
      return;
    }

    const token = window.localStorage.getItem('dira_access_token');
    if (!token) return;

    setLoadingQuotes(true);
    fetch(`${apiUrl}/api/v1/rfqs/${selectedRfqId}/quotes`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load quotes');
        const body = await response.json();
        setQuotes(body.items ?? []);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load quotes'))
      .finally(() => setLoadingQuotes(false));
  }, [apiUrl, selectedRfqId]);

  async function awardQuote(quoteId: string) {
    const token = window.localStorage.getItem('dira_access_token');
    if (!token) {
      setError('Sign in to continue.');
      return;
    }

    if (!selectedRfqId) return;
    setAwardingId(quoteId);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/v1/rfqs/${selectedRfqId}/award`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quotationId: quoteId }),
      });
      const body = await response.json().catch(() => undefined);
      if (!response.ok) throw new Error(body?.message ?? 'Unable to award quote');
      const refreshed = await fetch(`${apiUrl}/api/v1/rfqs`, { headers: { Authorization: `Bearer ${token}` } });
      if (refreshed.ok) {
        const rfqBody = await refreshed.json();
        setRfqs(rfqBody.items ?? []);
      }
      const quotesResponse = await fetch(`${apiUrl}/api/v1/rfqs/${selectedRfqId}/quotes`, { headers: { Authorization: `Bearer ${token}` } });
      if (quotesResponse.ok) {
        const quoteBody = await quotesResponse.json();
        setQuotes(quoteBody.items ?? []);
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Unable to award quote');
    } finally {
      setAwardingId(null);
    }
  }

  if (loading) return <main className="p-8"><h1 className="text-3xl font-bold text-slate-900">Quotes</h1><div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-slate-500">Loading quotes...</div></main>;

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold text-slate-900">Quote comparison</h1>
      {error && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
        <label className="text-sm font-medium text-slate-700">Select RFQ</label>
        <select
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={selectedRfqId}
          onChange={(event) => setSelectedRfqId(event.target.value)}
        >
          {rfqs.length === 0 ? <option value="">No RFQs available</option> : rfqs.map((rfq) => (
            <option key={rfq.id} value={rfq.id}>{rfq.rfqNumber} — {rfq.title}</option>
          ))}
        </select>
      </div>

      {selectedRfq && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <strong className="text-slate-900">{selectedRfq.rfqNumber}</strong> · {selectedRfq.title} · <span className="badge bg-amber-100 text-amber-800">{selectedRfq.status}</span>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {loadingQuotes ? (
          <div className="card p-6 text-slate-500">Loading quote submissions...</div>
        ) : quotes.length === 0 ? (
          <div className="card p-6 text-slate-500">No supplier quotes have been submitted yet for this RFQ.</div>
        ) : quotes.map((quote) => (
          <div key={quote.id} className="card p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900">{quote.organization?.tradingName ?? quote.organization?.legalName ?? 'Supplier'}</h2>
                  <span className="badge bg-slate-100 text-slate-700">{quote.status}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{quote.quoteNumber}</p>
                <p className="mt-2 text-sm text-slate-600">{quote.organization?.city ?? 'Unknown city'}, {quote.organization?.country ?? 'Unknown country'}</p>
              </div>

              <div className="text-left md:text-right">
                <p className="text-xl font-bold text-slate-900">{quote.currency} {quote.total.toLocaleString()}</p>
                <p className="text-sm text-slate-500">Delivery: {quote.deliveryDays ? `${quote.deliveryDays} days` : 'TBD'}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-600">
                <div className="font-medium text-slate-800">Breakdown</div>
                <div className="mt-2 flex justify-between"><span>Subtotal</span><span>{quote.currency} {quote.total.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Payment</span><span>{quote.paymentTerms ?? 'TBD'}</span></div>
                <div className="flex justify-between"><span>Notes</span><span>{quote.notes ? quote.notes.slice(0, 80) : '—'}</span></div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-600">
                <div className="font-medium text-slate-800">Line items</div>
                {quote.items && quote.items.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {quote.items.map((item) => (
                      <li key={item.id} className="flex justify-between gap-2">
                        <span>{item.rfqItemId ?? 'Item'}</span>
                        <span>{item.quantity} × {item.unitPrice}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-2 text-slate-500">No line items listed.</p>}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              {selectedRfq?.status === 'QUOTES_RECEIVED' || selectedRfq?.status === 'EVALUATION' ? (
                <button
                  type="button"
                  onClick={() => awardQuote(quote.id)}
                  disabled={awardingId === quote.id}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {awardingId === quote.id ? 'Awarding...' : 'Award quote'}
                </button>
              ) : (
                <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">{quote.status}</span>
              )}
            </div>
            <AttachmentUpload entityType="QUOTATION" entityId={quote.id} documentType="QUOTE" label="Supporting quotation document" />
          </div>
        ))}
      </div>
    </main>
  );
}
