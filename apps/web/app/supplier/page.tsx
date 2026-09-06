'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { TopBar } from '../../components/TopBar';
import { ApiError, apiFetch, formatDate, formatMoney, statusTone } from '../../lib/api';

type SupplierDashboard = {
  openRfqs: number;
  submittedQuotes: number;
  awards: number;
  purchaseOrders: number;
  awaitingAcknowledgement: number;
  deliveriesInProgress: number;
  invoices: number;
  invoicesAwaitingDecision: number;
  outstandingReceivable: number;
  recentPurchaseOrders: Array<{ id: string; poNumber: string; status: string; total: string; currency: string; issuedAt: string | null }>;
};

type SupplierRfq = {
  invitationId: string;
  responseStatus: string;
  rfq: { id: string; rfqNumber: string; title: string; status: string; quoteDeadline: string | null; currency: string };
  myQuotation: { id: string; status: string; total: string; currency: string } | null;
};

type SupplierInvoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  total: string;
  currency: string;
  dueDate: string | null;
  paymentRecords: Array<{ id: string; amount: string }>;
};

const METRICS: Array<{ key: keyof SupplierDashboard; label: string }> = [
  { key: 'openRfqs', label: 'Open RFQs' },
  { key: 'submittedQuotes', label: 'Submitted quotes' },
  { key: 'awards', label: 'Awards' },
  { key: 'purchaseOrders', label: 'Purchase orders' },
  { key: 'awaitingAcknowledgement', label: 'Awaiting acknowledgement' },
  { key: 'deliveriesInProgress', label: 'Deliveries in progress' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'invoicesAwaitingDecision', label: 'Invoices under review' },
];

export default function SupplierPortalPage() {
  const [dashboard, setDashboard] = useState<SupplierDashboard | null>(null);
  const [rfqs, setRfqs] = useState<SupplierRfq[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [dashboardData, rfqData, invoiceData, orderData] = await Promise.all([
        apiFetch<SupplierDashboard>('/supplier/dashboard'),
        apiFetch<{ items: SupplierRfq[] }>('/supplier/rfqs'),
        apiFetch<{ items: SupplierInvoice[] }>('/invoices'),
        apiFetch<{ items: any[] }>('/purchase-orders'),
      ]);
      setDashboard(dashboardData);
      setRfqs(rfqData.items ?? []);
      setInvoices(invoiceData.items ?? []);
      setOrders(orderData.items ?? []);
      setError(null);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to load the supplier portal');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function acknowledge(purchaseOrderId: string, poNumber: string) {
    try {
      await apiFetch(`/purchase-orders/${purchaseOrderId}/acknowledge`, { method: 'POST', body: JSON.stringify({}) });
      setNotice(`${poNumber} acknowledged.`);
      setError(null);
      await load();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Acknowledgement failed');
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <TopBar />
        <main className="space-y-6 p-4 sm:p-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Supplier portal</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Your Dira workspace</h1>
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
          {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>}

          {loading ? (
            <div className="card p-6 text-sm text-slate-500">Loading your data…</div>
          ) : dashboard ? (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {METRICS.map((metric) => (
                  <div key={metric.key} className="card p-4">
                    <p className="text-xs text-slate-500">{metric.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{dashboard[metric.key] as number}</p>
                  </div>
                ))}
              </section>

              <section className="card p-5">
                <p className="text-xs text-slate-500">Outstanding receivable</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(dashboard.outstandingReceivable)}</p>
              </section>

              <section className="card p-5">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">RFQ invitations</h2>
                {rfqs.length === 0 ? (
                  <p className="text-sm text-slate-500">You have not been invited to any RFQs yet.</p>
                ) : (
                  <div className="space-y-3">
                    {rfqs.map((row) => (
                      <div key={row.invitationId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{row.rfq.title}</p>
                          <p className="text-xs text-slate-500">
                            {row.rfq.rfqNumber} · closes {formatDate(row.rfq.quoteDeadline)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {row.myQuotation ? (
                            <span className={`badge ${statusTone(row.myQuotation.status)}`}>
                              {row.myQuotation.status} · {formatMoney(row.myQuotation.total, row.myQuotation.currency)}
                            </span>
                          ) : (
                            <span className={`badge ${statusTone(row.rfq.status)}`}>{row.rfq.status}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="card p-5">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Purchase orders</h2>
                {orders.length === 0 ? (
                  <p className="text-sm text-slate-500">No purchase orders have been issued to you yet.</p>
                ) : (
                  <div className="space-y-3">
                    {orders.map((order) => (
                      <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">{order.poNumber}</p>
                          <p className="text-xs text-slate-500">
                            {formatMoney(order.total, order.currency)} · issued {formatDate(order.issuedAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`badge ${statusTone(order.status)}`}>{order.status}</span>
                          {['ISSUED', 'SENT'].includes(order.status) && (
                            <button
                              type="button"
                              onClick={() => acknowledge(order.id, order.poNumber)}
                              className="rounded-xl bg-navy px-3 py-2 text-xs font-medium text-white"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="card p-5">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Invoices and payment status</h2>
                {invoices.length === 0 ? (
                  <p className="text-sm text-slate-500">You have not submitted any invoices yet.</p>
                ) : (
                  <div className="space-y-3">
                    {invoices.map((invoice) => {
                      const paid = invoice.paymentRecords.reduce((sum, payment) => sum + Number(payment.amount), 0);
                      return (
                        <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900">{invoice.invoiceNumber}</p>
                            <p className="text-xs text-slate-500">
                              {formatMoney(invoice.total, invoice.currency)} · paid {formatMoney(paid, invoice.currency)} · due {formatDate(invoice.dueDate)}
                            </p>
                          </div>
                          <span className={`badge ${statusTone(invoice.status)}`}>{invoice.status}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
