'use client';

import { FormEvent, useState } from 'react';
import { ApiError, apiFetch, formatMoney } from '../lib/api';
import { VAT_RATE, calculateTotals, toNumber } from '../lib/calc';

export type QuotableRfq = {
  id: string;
  rfqNumber: string;
  currency: string;
  items: Array<{ id: string; name: string; quantity: string | null; unit: string | null; lastQuotedUnitPrice: number | null }>;
};

function isoDate(daysAhead: number) {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Supplier enters unit prices only; quantities come from the RFQ and totals are calculated as they type. */
export function QuoteForm({ rfq, onSubmitted }: { rfq: QuotableRfq; onSubmitted: (message: string) => void }) {
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(rfq.items.map((item) => [item.id, item.lastQuotedUnitPrice === null ? '' : String(item.lastQuotedUnitPrice)])),
  );
  const [deliveryFee, setDeliveryFee] = useState('');
  const [discount, setDiscount] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('7');
  const [paymentTerms, setPaymentTerms] = useState('NET30');
  const [validUntil, setValidUntil] = useState(isoDate(30));
  const [vatRegistered, setVatRegistered] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = calculateTotals({
    lines: rfq.items.map((item) => ({ quantity: toNumber(item.quantity), unitPrice: toNumber(prices[item.id]) })),
    deliveryFee: toNumber(deliveryFee),
    discount: toNumber(discount),
    vatApplies: vatRegistered,
  });
  const reusedPrices = rfq.items.some((item) => item.lastQuotedUnitPrice !== null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rfq.items.some((item) => prices[item.id] === '')) {
      setError('Enter a unit price for every item.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/rfqs/${rfq.id}/quotes`, {
        method: 'POST',
        body: JSON.stringify({
          currency: rfq.currency,
          tax: vatRegistered ? undefined : 0,
          deliveryFee: toNumber(deliveryFee),
          discount: toNumber(discount),
          deliveryDays: deliveryDays === '' ? undefined : toNumber(deliveryDays),
          paymentTerms: paymentTerms || undefined,
          validUntil: new Date(`${validUntil}T23:59:59`).toISOString(),
          items: rfq.items.map((item) => ({ rfqItemId: item.id, unitPrice: toNumber(prices[item.id]) })),
        }),
      });
      onSubmitted(`Quote submitted for ${rfq.rfqNumber}: ${formatMoney(totals.total, rfq.currency)}.`);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to submit quote');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 w-full space-y-3 rounded-xl bg-slate-50 p-3">
      {reusedPrices && <p className="text-xs text-emerald-700">Prices filled in from your last quote for the same items. Update any that have changed.</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr><th className="pb-1">Item</th><th className="pb-1 text-right">Qty</th><th className="pb-1">Unit price ({rfq.currency})</th><th className="pb-1 text-right">Line total</th></tr>
          </thead>
          <tbody>
            {rfq.items.map((item, index) => (
              <tr key={item.id}>
                <td className="py-1 pr-2 text-slate-900">{item.name}</td>
                <td className="py-1 pr-2 text-right text-slate-700">{toNumber(item.quantity)} {item.unit ?? ''}</td>
                <td className="w-40 py-1 pr-2">
                  <input type="number" min={0} step="any" required className="field mt-0" value={prices[item.id]} onChange={(event) => setPrices((current) => ({ ...current, [item.id]: event.target.value }))} />
                </td>
                <td className="py-1 text-right font-medium text-slate-900">{formatMoney(totals.lineTotals[index], rfq.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <label className="text-xs text-slate-600">Delivery fee<input type="number" min={0} step="any" className="field" value={deliveryFee} onChange={(event) => setDeliveryFee(event.target.value)} /></label>
        <label className="text-xs text-slate-600">Discount<input type="number" min={0} step="any" className="field" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label>
        <label className="text-xs text-slate-600">Delivery (days)<input type="number" min={0} className="field" value={deliveryDays} onChange={(event) => setDeliveryDays(event.target.value)} /></label>
        <label className="text-xs text-slate-600">Payment terms<input className="field" value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} /></label>
        <label className="text-xs text-slate-600">Valid until<input type="date" required className="field" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></label>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={vatRegistered} onChange={(event) => setVatRegistered(event.target.checked)} />
        We are VAT registered (charge {VAT_RATE * 100}% VAT)
      </label>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <dl className="grid min-w-[220px] gap-1 text-sm">
          <div className="flex justify-between gap-6"><dt className="text-slate-500">Subtotal</dt><dd>{formatMoney(totals.subtotal, rfq.currency)}</dd></div>
          <div className="flex justify-between gap-6"><dt className="text-slate-500">VAT</dt><dd>{formatMoney(totals.tax, rfq.currency)}</dd></div>
          <div className="flex justify-between gap-6 border-t border-slate-200 pt-1 font-semibold text-slate-900"><dt>Total</dt><dd>{formatMoney(totals.total, rfq.currency)}</dd></div>
        </dl>
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit quote'}</button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
