'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ApiError, apiFetch, formatMoney } from '../lib/api';
import { calculateTotals, toNumber } from '../lib/calc';

type InvoiceDraft = {
  currency: string;
  basis: 'RECEIVED' | 'DISPATCHED';
  vatRegistered: boolean;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  lines: Array<{ purchaseOrderItemId: string; description: string; orderedQuantity: number; deliveredQuantity: number; invoicedQuantity: number; quantity: number; unitPrice: number }>;
};

/** Pre-filled from the purchase order: billable quantities, PO prices, VAT treatment and due date from payment terms. */
export function InvoiceForm({ purchaseOrderId, onSubmitted }: { purchaseOrderId: string; onSubmitted: (message: string) => void }) {
  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<InvoiceDraft>(`/purchase-orders/${purchaseOrderId}/invoice-draft`)
      .then((data) => {
        setDraft(data);
        setQuantities(Object.fromEntries(data.lines.map((line) => [line.purchaseOrderItemId, String(line.quantity)])));
        setInvoiceNumber(data.invoiceNumber);
        setDueDate(data.dueDate.slice(0, 10));
      })
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : 'Unable to prepare the invoice'));
  }, [purchaseOrderId]);

  if (!draft) return <p className="mt-3 text-sm text-slate-500">{error ?? 'Preparing invoice from the purchase order…'}</p>;

  const totals = calculateTotals({
    lines: draft.lines.map((line) => ({ quantity: toNumber(quantities[line.purchaseOrderItemId]), unitPrice: line.unitPrice })),
    vatApplies: draft.vatRegistered,
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const items = draft!.lines
      .map((line) => ({ purchaseOrderItemId: line.purchaseOrderItemId, description: line.description, quantity: toNumber(quantities[line.purchaseOrderItemId]), unitPrice: line.unitPrice }))
      .filter((line) => line.quantity > 0);
    if (items.length === 0) {
      setError('Nothing to invoice yet.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/purchase-orders/${purchaseOrderId}/invoices`, {
        method: 'POST',
        body: JSON.stringify({ poId: purchaseOrderId, invoiceNumber, dueDate: new Date(`${dueDate}T23:59:59`).toISOString(), items }),
      });
      onSubmitted(`Invoice ${invoiceNumber} submitted for ${formatMoney(totals.total, draft!.currency)}.`);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to submit invoice');
    } finally {
      setBusy(false);
    }
  }

  const nothingDue = draft.lines.every((line) => line.quantity === 0);

  return (
    <form onSubmit={submit} className="mt-3 w-full space-y-3 rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-600">
        {nothingDue
          ? 'Everything delivered so far has already been invoiced.'
          : draft.basis === 'RECEIVED'
            ? 'Quantities are what the buyer has received and you have not billed yet.'
            : 'The buyer has not confirmed receipt yet, so quantities are based on what you dispatched. The invoice may be held until receipt is recorded.'}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr><th className="pb-1">Item</th><th className="pb-1 text-right">Delivered</th><th className="pb-1 text-right">Billed</th><th className="pb-1">Invoice qty</th><th className="pb-1 text-right">Unit price</th><th className="pb-1 text-right">Line total</th></tr>
          </thead>
          <tbody>
            {draft.lines.map((line, index) => (
              <tr key={line.purchaseOrderItemId}>
                <td className="py-1 pr-2 text-slate-900">{line.description}</td>
                <td className="py-1 pr-2 text-right text-slate-700">{line.deliveredQuantity}</td>
                <td className="py-1 pr-2 text-right text-slate-700">{line.invoicedQuantity}</td>
                <td className="w-28 py-1 pr-2">
                  <input type="number" min={0} max={line.quantity} step="any" className="field mt-0" value={quantities[line.purchaseOrderItemId] ?? ''} onChange={(event) => setQuantities((current) => ({ ...current, [line.purchaseOrderItemId]: event.target.value }))} />
                </td>
                <td className="py-1 pr-2 text-right text-slate-700">{formatMoney(line.unitPrice, draft.currency)}</td>
                <td className="py-1 text-right font-medium text-slate-900">{formatMoney(totals.lineTotals[index], draft.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-600">Invoice number<input required className="field" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} /></label>
        <label className="text-xs text-slate-600">Due date<input type="date" required className="field" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <dl className="grid min-w-[220px] gap-1 text-sm">
          <div className="flex justify-between gap-6"><dt className="text-slate-500">Subtotal</dt><dd>{formatMoney(totals.subtotal, draft.currency)}</dd></div>
          <div className="flex justify-between gap-6"><dt className="text-slate-500">VAT</dt><dd>{formatMoney(totals.tax, draft.currency)}</dd></div>
          <div className="flex justify-between gap-6 border-t border-slate-200 pt-1 font-semibold text-slate-900"><dt>Total</dt><dd>{formatMoney(totals.total, draft.currency)}</dd></div>
        </dl>
        <button type="submit" className="btn-primary" disabled={busy || nothingDue}>{busy ? 'Submitting…' : 'Submit invoice'}</button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
