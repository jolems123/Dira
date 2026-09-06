'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { ApiError, apiFetch, formatDate, formatMoney, statusTone } from '../lib/api';

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
  purchaseRequests: number;
};

type ExceptionRow = {
  invoiceId: string;
  invoiceNumber: string;
  blocking: number;
  warnings: number;
  exceptions: Array<{ code: string; severity: string; message: string }>;
};

type ActivityItem = {
  id: string;
  title?: string;
  requestNumber?: string;
  rfqNumber?: string;
  status?: string;
  createdAt?: string;
};

const METRICS: Array<{ key: keyof Overview; label: string; href: string }> = [
  { key: 'requestsAwaitingApproval', label: 'Requests awaiting approval', href: '/purchase-requests' },
  { key: 'openRfqs', label: 'Open RFQs', href: '/rfqs' },
  { key: 'quotesAwaitingReview', label: 'Quotes awaiting review', href: '/quotes' },
  { key: 'awardsAwaitingPo', label: 'Awards awaiting PO', href: '/quotes' },
  { key: 'openPurchaseOrders', label: 'Open purchase orders', href: '/orders' },
  { key: 'deliveriesDue', label: 'Deliveries due', href: '/orders' },
  { key: 'goodsAwaitingReceipt', label: 'Goods awaiting receipt', href: '/orders' },
  { key: 'invoicesAwaitingMatch', label: 'Invoices awaiting match', href: '/invoices' },
  { key: 'invoicesAwaitingApproval', label: 'Invoices awaiting approval', href: '/invoices' },
  { key: 'paymentsDue', label: 'Payments due', href: '/invoices' },
];

export default function HomePage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<Overview>('/analytics/overview'),
      apiFetch<{ items: ExceptionRow[] }>('/exceptions').catch(() => ({ items: [] })),
      apiFetch<{ items: ActivityItem[] }>('/purchase-requests').catch(() => ({ items: [] })),
      apiFetch<{ items: ActivityItem[] }>('/rfqs').catch(() => ({ items: [] })),
    ])
      .then(([overviewData, exceptionData, requestData, rfqData]) => {
        setOverview(overviewData);
        setExceptions(exceptionData.items ?? []);
        setActivity(
          [...(requestData.items ?? []), ...(rfqData.items ?? [])]
            .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
            .slice(0, 6),
        );
      })
      .catch((reason: unknown) => {
        setError(reason instanceof ApiError ? reason.message : 'Unable to load dashboard data');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <TopBar />
        <main className="space-y-6 p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Buyer dashboard</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Procurement overview</h1>
            </div>
            <Link
              href="/purchase-requests"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 font-medium text-white shadow-soft"
            >
              Create purchase request
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}

          {loading ? (
            <div className="card p-6 text-sm text-slate-500">Loading live procurement data…</div>
          ) : overview ? (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {METRICS.map((metric) => (
                  <Link key={metric.key} href={metric.href} className="card p-4 transition hover:shadow-md">
                    <p className="text-xs text-slate-500">{metric.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{overview[metric.key] as number}</p>
                  </Link>
                ))}
              </section>

              <section className="grid gap-4 sm:grid-cols-2">
                <div className="card p-5">
                  <p className="text-xs text-slate-500">Payments due value</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(overview.paymentsDueValue)}</p>
                </div>
                <Link href="/exceptions" className="card p-5 transition hover:shadow-md">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Exceptions / mismatches
                  </div>
                  <p className={`mt-2 text-2xl font-semibold ${overview.exceptions > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                    {overview.exceptions}
                  </p>
                </Link>
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
                <div className="card p-5">
                  <h2 className="mb-4 text-lg font-semibold text-slate-900">Recent activity</h2>
                  <div className="space-y-3">
                    {activity.length > 0 ? (
                      activity.map((item) => (
                        <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {item.title ?? item.requestNumber ?? item.rfqNumber}
                            </p>
                            <p className="text-xs text-slate-500">{item.requestNumber ? 'Purchase request' : 'RFQ'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`badge ${statusTone(item.status ?? '')}`}>{item.status}</span>
                            <span className="text-xs text-slate-500">{formatDate(item.createdAt)}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                        No procurement activity recorded for this organization yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="card p-5">
                  <h2 className="mb-4 text-lg font-semibold text-slate-900">Match exceptions</h2>
                  <div className="space-y-3">
                    {exceptions.length > 0 ? (
                      exceptions.slice(0, 5).map((row) => (
                        <Link
                          key={row.invoiceId}
                          href={`/exceptions#${row.invoiceId}`}
                          className="block rounded-xl border border-red-200 bg-red-50 p-3 text-red-900"
                        >
                          <p className="text-sm font-semibold">Invoice {row.invoiceNumber}</p>
                          <p className="mt-1 text-xs">{row.exceptions[0]?.message}</p>
                          <p className="mt-1 text-xs font-medium">
                            {row.blocking} blocking · {row.warnings} warning{row.warnings === 1 ? '' : 's'}
                          </p>
                        </Link>
                      ))
                    ) : (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                        No three-way match exceptions outstanding.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
