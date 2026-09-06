'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { TopBar } from '../../components/TopBar';
import { ApiError, apiFetch, formatMoney } from '../../lib/api';

type MatchLine = {
  purchaseOrderItemId: string;
  name: string;
  orderedQuantity: number;
  orderedUnitPrice: number;
  receivedQuantity: number;
  invoicedQuantity: number;
  invoicedUnitPrice: number;
  quantityVariance: number;
  priceVariance: number;
};

type ExceptionRow = {
  invoiceId: string;
  invoiceNumber: string;
  purchaseOrderId: string | null;
  blocking: number;
  warnings: number;
  exceptions: Array<{ code: string; severity: string; message: string }>;
};

type MatchDetail = {
  invoiceNumber: string;
  poNumber?: string;
  result: {
    matched: boolean;
    blocking: number;
    warnings: number;
    exceptions: Array<{ code: string; severity: string; message: string }>;
    lines: MatchLine[];
    totals: { poTotal: number; invoiceTotal: number; receivedValue: number; variance: number };
  };
};

export default function ExceptionsPage() {
  const [rows, setRows] = useState<ExceptionRow[]>([]);
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ items: ExceptionRow[] }>('/exceptions')
      .then((data) => setRows(data.items ?? []))
      .catch((reason: unknown) => setError(reason instanceof ApiError ? reason.message : 'Unable to load exceptions'))
      .finally(() => setLoading(false));
  }, []);

  async function open(invoiceId: string) {
    setSelected(invoiceId);
    setDetail(null);
    try {
      setDetail(await apiFetch<MatchDetail>(`/invoices/${invoiceId}/three-way-match`));
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to load match detail');
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <TopBar />
        <main className="space-y-6 p-4 sm:p-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Finance review</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Three-way match exceptions</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Purchase order, goods receipt and supplier invoice are compared line by line. Blocking exceptions must be
              resolved with the supplier before an invoice can be approved.
            </p>
          </div>

          {error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}

          {loading ? (
            <div className="card p-6 text-sm text-slate-500">Loading match results…</div>
          ) : rows.length === 0 ? (
            <div className="card flex items-center gap-3 p-6 text-sm text-emerald-900">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Every open invoice matches its purchase order and goods receipt.
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="card p-5">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Invoices with exceptions</h2>
                <div className="space-y-3">
                  {rows.map((row) => (
                    <button
                      key={row.invoiceId}
                      id={row.invoiceId}
                      type="button"
                      onClick={() => open(row.invoiceId)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        selected === row.invoiceId ? 'border-navy bg-slate-50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">Invoice {row.invoiceNumber}</p>
                        <span className={`badge ${row.blocking > 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                          {row.blocking} blocking · {row.warnings} warning{row.warnings === 1 ? '' : 's'}
                        </span>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {row.exceptions.slice(0, 3).map((exception, index) => (
                          <li key={`${row.invoiceId}-${index}`} className="flex items-start gap-2 text-xs text-slate-600">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                            <span>{exception.message}</span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
              </div>

              <div className="card p-5">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Line comparison</h2>
                {!selected ? (
                  <p className="text-sm text-slate-500">Select an invoice to compare ordered, received and invoiced quantities.</p>
                ) : !detail ? (
                  <p className="text-sm text-slate-500">Loading comparison…</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">PO total</p>
                        <p className="text-sm font-semibold text-slate-900">{formatMoney(detail.result.totals.poTotal)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Received value</p>
                        <p className="text-sm font-semibold text-slate-900">{formatMoney(detail.result.totals.receivedValue)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Invoice total</p>
                        <p className="text-sm font-semibold text-slate-900">{formatMoney(detail.result.totals.invoiceTotal)}</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px] text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="py-2">Line</th>
                            <th className="py-2 text-right">Ordered</th>
                            <th className="py-2 text-right">Received</th>
                            <th className="py-2 text-right">Invoiced</th>
                            <th className="py-2 text-right">Unit price change</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {detail.result.lines.map((line) => (
                            <tr key={line.purchaseOrderItemId}>
                              <td className="py-2 pr-2 text-slate-900">{line.name}</td>
                              <td className="py-2 text-right text-slate-700">{line.orderedQuantity}</td>
                              <td className="py-2 text-right text-slate-700">{line.receivedQuantity}</td>
                              <td className={`py-2 text-right ${line.quantityVariance !== 0 ? 'font-semibold text-red-700' : 'text-slate-700'}`}>
                                {line.invoicedQuantity}
                              </td>
                              <td className={`py-2 text-right ${line.priceVariance !== 0 ? 'font-semibold text-red-700' : 'text-slate-700'}`}>
                                {line.priceVariance === 0 ? '—' : formatMoney(line.priceVariance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <ul className="space-y-2">
                      {detail.result.exceptions.map((exception, index) => (
                        <li
                          key={index}
                          className={`rounded-xl border p-3 text-xs ${
                            exception.severity === 'BLOCKING'
                              ? 'border-red-200 bg-red-50 text-red-900'
                              : 'border-amber-200 bg-amber-50 text-amber-900'
                          }`}
                        >
                          <span className="font-semibold">{exception.severity}</span> · {exception.code} — {exception.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
