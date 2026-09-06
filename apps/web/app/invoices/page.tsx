'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { TopBar } from '../../components/TopBar';
import { ApiError, apiFetch, formatDate, formatMoney, statusTone } from '../../lib/api';

type Payment = { id: string; amount: string; currency: string; reference: string | null; paidAt: string | null; paymentMethod: string };

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  currency: string;
  subtotal: string;
  tax: string;
  total: string;
  invoiceDate: string | null;
  dueDate: string | null;
  buyerOrganizationId: string;
  supplierOrganizationId: string;
  items: Array<{ id: string; description: string; quantity: string; unitPrice: string; subtotal: string }>;
  paymentRecords: Payment[];
  purchaseOrder: { id: string; poNumber: string; status: string } | null;
};

const APPROVABLE = ['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW', 'VERIFIED'];
const PAYABLE = ['APPROVED', 'PARTIALLY_PAID'];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<Record<string, string>>({});
  const [paymentReference, setPaymentReference] = useState<Record<string, string>>({});

  async function load() {
    try {
      const data = await apiFetch<{ items: Invoice[] }>('/invoices');
      setInvoices(data.items ?? []);
      setError(null);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to load invoices');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function paidTotal(invoice: Invoice) {
    return invoice.paymentRecords.reduce((sum, payment) => sum + Number(payment.amount), 0);
  }

  async function decide(invoice: Invoice, decision: 'APPROVED' | 'REJECTED' | 'RETURNED_FOR_CORRECTION') {
    setBusy(invoice.id);
    setNotice(null);
    try {
      await apiFetch(`/invoices/${invoice.id}/decision`, { method: 'POST', body: JSON.stringify({ decision }) });
      setNotice(`Invoice ${invoice.invoiceNumber} marked ${decision.toLowerCase().replace(/_/g, ' ')}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Decision failed');
    } finally {
      setBusy(null);
    }
  }

  async function pay(invoice: Invoice) {
    const amount = Number(paymentAmount[invoice.id]);
    const reference = paymentReference[invoice.id]?.trim();
    if (!amount || amount <= 0) {
      setError('Enter a payment amount greater than zero.');
      return;
    }
    if (!reference) {
      setError('A payment reference is required.');
      return;
    }
    setBusy(invoice.id);
    setNotice(null);
    try {
      await apiFetch(`/invoices/${invoice.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          currency: invoice.currency,
          paymentDate: new Date().toISOString(),
          paymentMethod: 'BANK_TRANSFER',
          reference,
        }),
      });
      setNotice(`Payment of ${formatMoney(amount, invoice.currency)} recorded against ${invoice.invoiceNumber}.`);
      setPaymentAmount((current) => ({ ...current, [invoice.id]: '' }));
      setPaymentReference((current) => ({ ...current, [invoice.id]: '' }));
      setError(null);
      await load();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Payment failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <TopBar />
        <main className="space-y-6 p-4 sm:p-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Accounts payable</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Supplier invoices</h1>
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
          {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>}

          {loading ? (
            <div className="card p-6 text-sm text-slate-500">Loading invoices…</div>
          ) : invoices.length === 0 ? (
            <div className="card p-6 text-sm text-slate-500">No invoices have been submitted against your purchase orders yet.</div>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => {
                const paid = paidTotal(invoice);
                const outstanding = Number(invoice.total) - paid;
                return (
                  <article key={invoice.id} className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-slate-900">Invoice {invoice.invoiceNumber}</h2>
                        <p className="text-sm text-slate-600">
                          {invoice.purchaseOrder ? `Against ${invoice.purchaseOrder.poNumber}` : 'No linked purchase order'} ·
                          {' '}Due {formatDate(invoice.dueDate)}
                        </p>
                      </div>
                      <span className={`badge ${statusTone(invoice.status)}`}>{invoice.status}</span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Subtotal</p>
                        <p className="text-sm font-semibold text-slate-900">{formatMoney(invoice.subtotal, invoice.currency)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Tax</p>
                        <p className="text-sm font-semibold text-slate-900">{formatMoney(invoice.tax, invoice.currency)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Total</p>
                        <p className="text-sm font-semibold text-slate-900">{formatMoney(invoice.total, invoice.currency)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Outstanding</p>
                        <p className="text-sm font-semibold text-slate-900">{formatMoney(outstanding, invoice.currency)}</p>
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[480px] text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="py-2">Description</th>
                            <th className="py-2 text-right">Qty</th>
                            <th className="py-2 text-right">Unit price</th>
                            <th className="py-2 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {invoice.items.map((item) => (
                            <tr key={item.id}>
                              <td className="py-2 pr-2 text-slate-900">{item.description}</td>
                              <td className="py-2 text-right text-slate-700">{Number(item.quantity)}</td>
                              <td className="py-2 text-right text-slate-700">{formatMoney(item.unitPrice, invoice.currency)}</td>
                              <td className="py-2 text-right text-slate-700">{formatMoney(item.subtotal, invoice.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {invoice.paymentRecords.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payments recorded</p>
                        {invoice.paymentRecords.map((payment) => (
                          <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                            <span className="text-slate-900">{formatMoney(payment.amount, payment.currency)}</span>
                            <span className="text-xs text-slate-500">
                              {payment.reference} · {payment.paymentMethod} · {formatDate(payment.paidAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {APPROVABLE.includes(invoice.status) && (
                        <>
                          <button
                            type="button"
                            disabled={busy === invoice.id}
                            onClick={() => decide(invoice, 'APPROVED')}
                            className="rounded-xl bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busy === invoice.id}
                            onClick={() => decide(invoice, 'RETURNED_FOR_CORRECTION')}
                            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 disabled:opacity-50"
                          >
                            Return for correction
                          </button>
                          <button
                            type="button"
                            disabled={busy === invoice.id}
                            onClick={() => decide(invoice, 'REJECTED')}
                            className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>

                    {PAYABLE.includes(invoice.status) && outstanding > 0 && (
                      <div className="mt-4 flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-end">
                        <label className="flex-1 text-xs text-slate-600">
                          Amount
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={paymentAmount[invoice.id] ?? ''}
                            onChange={(event) => setPaymentAmount((current) => ({ ...current, [invoice.id]: event.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                            placeholder={String(outstanding.toFixed(2))}
                          />
                        </label>
                        <label className="flex-1 text-xs text-slate-600">
                          Payment reference
                          <input
                            value={paymentReference[invoice.id] ?? ''}
                            onChange={(event) => setPaymentReference((current) => ({ ...current, [invoice.id]: event.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={busy === invoice.id}
                          onClick={() => pay(invoice)}
                          className="rounded-xl bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          Record payment
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
