'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { TopBar } from '../../components/TopBar';
import { ApiError, apiFetch, formatDate, formatMoney, statusTone } from '../../lib/api';

type OrderItem = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  unitOfMeasure?: string | null;
};

type DeliveryItem = { purchaseOrderItemId: string; quantity: string; rejectedQuantity?: string | null };

type Delivery = {
  id: string;
  kind: string;
  status: string;
  reference?: string | null;
  createdAt: string;
  expectedDeliveryDate?: string | null;
  items: DeliveryItem[];
};

type PurchaseOrder = {
  id: string;
  poNumber: string;
  status: string;
  total: string;
  currency: string;
  issuedAt?: string | null;
  expectedDeliveryDate?: string | null;
  paymentTerms?: string | null;
  deliveryAddress?: string | null;
  buyerOrganizationId: string;
  supplierOrganizationId: string;
  supplier?: { id: string; legalName: string } | null;
  buyer?: { id: string; legalName: string } | null;
  items: OrderItem[];
  deliveries: Delivery[];
  invoices: Array<{ id: string; invoiceNumber: string; status: string; total: string }>;
};

function sumFor(deliveries: Delivery[], kind: string, itemId: string) {
  return deliveries
    .filter((delivery) => delivery.kind === kind)
    .flatMap((delivery) => delivery.items)
    .filter((item) => item.purchaseOrderItemId === itemId)
    .reduce((total, item) => total + Number(item.quantity), 0);
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [receiptDraft, setReceiptDraft] = useState<Record<string, string>>({});
  const [dispatchDraft, setDispatchDraft] = useState<Record<string, string>>({});
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [me, data] = await Promise.all([
        apiFetch<{ organization: { id: string } | null }>('/auth/me'),
        apiFetch<{ items: PurchaseOrder[] }>('/purchase-orders'),
      ]);
      setOrgId(me.organization?.id ?? null);
      setOrders(data.items ?? []);
      setError(null);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to load purchase orders');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const selected = useMemo(
    () => orders.find((order) => order.id === selectedId) ?? orders[0] ?? null,
    [orders, selectedId],
  );
  const isSupplier = selected ? orgId === selected.supplierOrganizationId : false;
  const isBuyer = selected ? orgId === selected.buyerOrganizationId : false;

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      setNotice(label);
      setError(null);
      setReceiptDraft({});
      setDispatchDraft({});
      setReference('');
      await load();
    } catch (reason) {
      setNotice(null);
      setError(reason instanceof ApiError ? reason.message : `${label} failed`);
    } finally {
      setBusy(false);
    }
  }

  function draftLines(draft: Record<string, string>, key: 'quantity' | 'receivedQuantity') {
    return Object.entries(draft)
      .map(([purchaseOrderItemId, value]) => ({ purchaseOrderItemId, [key]: Number(value) }))
      .filter((line) => Number((line as never as Record<string, number>)[key]) > 0) as never[];
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <TopBar />
        <main className="space-y-6 p-4 sm:p-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Fulfilment</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Purchase orders &amp; deliveries</h1>
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
          {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>}

          {loading ? (
            <div className="card p-6 text-sm text-slate-500">Loading purchase orders…</div>
          ) : orders.length === 0 ? (
            <div className="card p-6 text-sm text-slate-500">No purchase orders yet. Award a quotation to create the first PO.</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <section className="card max-h-[70vh] space-y-2 overflow-auto p-4">
                {orders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedId(order.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selected?.id === order.id ? 'border-navy bg-slate-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">{order.poNumber}</span>
                      <span className={`badge ${statusTone(order.status)}`}>{order.status}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {order.supplier?.legalName ?? 'Supplier pending'} · {formatMoney(order.total, order.currency)}
                    </p>
                  </button>
                ))}
              </section>

              {selected && (
                <section className="space-y-4">
                  <div className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-slate-900">{selected.poNumber}</h2>
                        <p className="text-sm text-slate-500">
                          {selected.supplier?.legalName ?? '—'} · issued {formatDate(selected.issuedAt)}
                        </p>
                      </div>
                      <span className={`badge ${statusTone(selected.status)}`}>{selected.status}</span>
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-xs text-slate-500">Total</dt>
                        <dd className="font-semibold text-slate-900">{formatMoney(selected.total, selected.currency)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Payment terms</dt>
                        <dd className="font-semibold text-slate-900">{selected.paymentTerms ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Delivery date</dt>
                        <dd className="font-semibold text-slate-900">{formatDate(selected.expectedDeliveryDate)}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="card overflow-x-auto p-5">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Line reconciliation</h3>
                    <table className="w-full min-w-[540px] text-left text-sm">
                      <thead className="text-xs uppercase text-slate-500">
                        <tr>
                          <th className="pb-2">Description</th>
                          <th className="pb-2 text-right">Ordered</th>
                          <th className="pb-2 text-right">Dispatched</th>
                          <th className="pb-2 text-right">Received</th>
                          <th className="pb-2 text-right">Remaining</th>
                          <th className="pb-2 text-right">{isSupplier ? 'Dispatch now' : 'Receive now'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.items.map((item) => {
                          const ordered = Number(item.quantity);
                          const dispatched = sumFor(selected.deliveries, 'DISPATCH', item.id);
                          const received = sumFor(selected.deliveries, 'RECEIPT', item.id);
                          const remaining = Math.max(0, ordered - received);
                          const draft = isSupplier ? dispatchDraft : receiptDraft;
                          const setDraft = isSupplier ? setDispatchDraft : setReceiptDraft;
                          return (
                            <tr key={item.id} className="border-t border-slate-100">
                              <td className="py-2 pr-3 text-slate-900">{item.description}</td>
                              <td className="py-2 text-right text-slate-700">{ordered}</td>
                              <td className="py-2 text-right text-slate-700">{dispatched}</td>
                              <td className="py-2 text-right text-slate-700">{received}</td>
                              <td className="py-2 text-right font-semibold text-slate-900">{remaining}</td>
                              <td className="py-2 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  max={ordered}
                                  value={draft[item.id] ?? ''}
                                  onChange={(event) => setDraft((prev) => ({ ...prev, [item.id]: event.target.value }))}
                                  className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right"
                                  placeholder="0"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <input
                        value={reference}
                        onChange={(event) => setReference(event.target.value)}
                        placeholder={isSupplier ? 'Dispatch reference' : 'Delivery note reference'}
                        className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      {isSupplier && ['ISSUED', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED'].includes(selected.status) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run('Dispatch recorded.', () =>
                              apiFetch(`/purchase-orders/${selected.id}/dispatch`, {
                                method: 'POST',
                                body: JSON.stringify({
                                  dispatchReference: reference,
                                  items: draftLines(dispatchDraft, 'quantity'),
                                }),
                              }),
                            )
                          }
                          className="rounded-xl bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          Record dispatch
                        </button>
                      )}
                      {isSupplier && ['ISSUED', 'SENT'].includes(selected.status) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run('Purchase order acknowledged.', () =>
                              apiFetch(`/purchase-orders/${selected.id}/acknowledge`, { method: 'POST', body: JSON.stringify({}) }),
                            )
                          }
                          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                        >
                          Acknowledge PO
                        </button>
                      )}
                      {isBuyer && !['CLOSED', 'CANCELLED'].includes(selected.status) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run('Goods receipt recorded.', () =>
                              apiFetch(`/purchase-orders/${selected.id}/goods-receipt`, {
                                method: 'POST',
                                body: JSON.stringify({
                                  deliveryNoteReference: reference || undefined,
                                  items: draftLines(receiptDraft, 'receivedQuantity'),
                                }),
                              }),
                            )
                          }
                          className="rounded-xl bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          Record goods receipt
                        </button>
                      )}
                      {isBuyer && !['CLOSED', 'CANCELLED'].includes(selected.status) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run('Purchase order closed.', () =>
                              apiFetch(`/purchase-orders/${selected.id}/closeout`, { method: 'POST', body: JSON.stringify({}) }),
                            )
                          }
                          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                        >
                          Close out
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="card p-5">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Delivery history</h3>
                    {selected.deliveries.length === 0 ? (
                      <p className="text-sm text-slate-500">No dispatches or receipts recorded yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {selected.deliveries.map((delivery) => (
                          <li key={delivery.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                            <div>
                              <p className="font-medium text-slate-900">
                                {delivery.kind === 'DISPATCH' ? 'Dispatch' : 'Goods receipt'} · {delivery.reference ?? '—'}
                              </p>
                              <p className="text-xs text-slate-500">{formatDate(delivery.createdAt)}</p>
                            </div>
                            <span className={`badge ${statusTone(delivery.status)}`}>{delivery.status}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
