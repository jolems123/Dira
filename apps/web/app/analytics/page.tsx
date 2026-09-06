'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { TopBar } from '../../components/TopBar';
import { ApiError, apiFetch, formatMoney } from '../../lib/api';

type Overview = {
  requestsAwaitingApproval: number;
  openRfqs: number;
  quotesAwaitingReview: number;
  awardsAwaitingPo: number;
  openPurchaseOrders: number;
  deliveriesDue: number;
  goodsAwaitingReceipt: number;
  invoicesAwaitingMatch: number;
  invoicesAwaitingApproval: number;
  paymentsDue: number;
  paymentsDueValue: number;
  exceptions: number;
};

const GROUPS: Array<{ title: string; rows: Array<{ key: keyof Overview; label: string; money?: boolean }> }> = [
  {
    title: 'Sourcing',
    rows: [
      { key: 'requestsAwaitingApproval', label: 'Requests awaiting approval' },
      { key: 'openRfqs', label: 'Open RFQs' },
      { key: 'quotesAwaitingReview', label: 'Quotes awaiting review' },
      { key: 'awardsAwaitingPo', label: 'Awards awaiting PO' },
    ],
  },
  {
    title: 'Fulfilment',
    rows: [
      { key: 'openPurchaseOrders', label: 'Open purchase orders' },
      { key: 'deliveriesDue', label: 'Deliveries due' },
      { key: 'goodsAwaitingReceipt', label: 'Goods awaiting receipt' },
    ],
  },
  {
    title: 'Accounts payable',
    rows: [
      { key: 'invoicesAwaitingMatch', label: 'Invoices awaiting match' },
      { key: 'invoicesAwaitingApproval', label: 'Invoices awaiting approval' },
      { key: 'paymentsDue', label: 'Payments due' },
      { key: 'paymentsDueValue', label: 'Payments due value', money: true },
      { key: 'exceptions', label: 'Match exceptions' },
    ],
  },
];

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Overview>('/analytics/overview')
      .then((data) => {
        setOverview(data);
        setError(null);
      })
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : 'Unable to load analytics'));
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <TopBar />
        <main className="space-y-6 p-4 sm:p-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Analytics</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Procurement pipeline</h1>
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}

          {overview && (
            <div className="grid gap-4 lg:grid-cols-3">
              {GROUPS.map((group) => (
                <section key={group.title} className="card p-5">
                  <h2 className="mb-4 text-lg font-semibold text-slate-900">{group.title}</h2>
                  <dl className="space-y-3">
                    {group.rows.map((row) => (
                      <div key={row.key} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0">
                        <dt className="text-sm text-slate-600">{row.label}</dt>
                        <dd className="text-sm font-semibold text-slate-900">
                          {row.money ? formatMoney(overview[row.key]) : overview[row.key]}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
