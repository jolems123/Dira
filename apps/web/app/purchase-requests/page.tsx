'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { TopBar } from '../../components/TopBar';
import { ApiError, apiFetch, formatDate, formatMoney, statusTone } from '../../lib/api';
import { VAT_RATE, calculateTotals, toNumber } from '../../lib/calc';

type RequestItem = { id: string; name: string; quantity: string; unit?: string | null; estimatedUnitPrice?: string | null };

type PurchaseRequest = {
  id: string;
  requestNumber: string;
  title: string;
  status: string;
  department?: string | null;
  estimatedBudget?: string | null;
  currency: string;
  requiredBy?: string | null;
  items: RequestItem[];
  template?: { id: string; name: string } | null;
  sourceRequest?: { id: string; requestNumber: string } | null;
};

type Template = { id: string; name: string; items: unknown[] };

type DraftLine = { name: string; quantity: string; unit: string; estimatedUnitPrice: string };

const emptyLine = (): DraftLine => ({ name: '', quantity: '1', unit: '', estimatedUnitPrice: '' });

export default function PurchaseRequestsPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [requiredBy, setRequiredBy] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [templateName, setTemplateName] = useState<Record<string, string>>({});

  async function load() {
    try {
      const [requestData, templateData] = await Promise.all([
        apiFetch<{ items: PurchaseRequest[] }>('/purchase-requests'),
        apiFetch<{ items: Template[] }>('/templates'),
      ]);
      setRequests(requestData.items ?? []);
      setTemplates(templateData.items ?? []);
      setError(null);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to load purchase requests');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function run(key: string, success: string, action: () => Promise<unknown>) {
    setBusy(key);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      setError(null);
      await load();
      return true;
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Action failed');
      return false;
    } finally {
      setBusy(null);
    }
  }

  const pricedLines = lines.map((line) => ({ quantity: toNumber(line.quantity), unitPrice: toNumber(line.estimatedUnitPrice) }));
  const totals = calculateTotals({ lines: pricedLines });

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line, position) => (position === index ? { ...line, ...patch } : line)));
  }

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submit = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'submit';
    const items = lines
      .filter((line) => line.name.trim())
      .map((line) => ({
        name: line.name.trim(),
        quantity: toNumber(line.quantity),
        unit: line.unit.trim() || undefined,
        estimatedUnitPrice: line.estimatedUnitPrice === '' ? undefined : toNumber(line.estimatedUnitPrice),
      }));
    if (items.length === 0) {
      setError('Add at least one item.');
      return;
    }
    if (items.some((item) => item.quantity <= 0)) {
      setError('Every item needs a quantity greater than zero.');
      return;
    }
    const ok = await run('create', submit ? 'Request created and submitted for approval.' : 'Draft request saved.', async () => {
      const created = await apiFetch<PurchaseRequest>('/purchase-requests', {
        method: 'POST',
        body: JSON.stringify({
          title,
          department,
          requiredBy: requiredBy ? new Date(requiredBy).toISOString() : undefined,
          items,
        }),
      });
      if (submit) await apiFetch(`/purchase-requests/${created.id}/submit`, { method: 'POST', body: JSON.stringify({}) });
    });
    if (ok) {
      setTitle('');
      setDepartment('');
      setRequiredBy('');
      setLines([emptyLine()]);
      setShowForm(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <TopBar />
        <main className="space-y-6 p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Demand</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Purchase requests</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {templates.length > 0 && (
                <select
                  aria-label="Start from template"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                  value=""
                  disabled={busy !== null}
                  onChange={(event) => {
                    const template = templates.find((candidate) => candidate.id === event.target.value);
                    if (!template) return;
                    run('template', `Draft created from "${template.name}". Check quantities, then submit.`, () =>
                      apiFetch(`/templates/${template.id}/requests`, { method: 'POST', body: JSON.stringify({}) }),
                    );
                  }}
                >
                  <option value="">Start from template…</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
              )}
              <button type="button" className="btn-primary" onClick={() => setShowForm((open) => !open)}>
                {showForm ? 'Close form' : 'New request'}
              </button>
            </div>
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
          {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>}

          {showForm && (
            <form className="card space-y-4 p-5" onSubmit={createRequest}>
              <h2 className="text-lg font-semibold text-slate-900">New purchase request</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-sm text-slate-700">
                  Title
                  <input required minLength={3} className="field" value={title} onChange={(event) => setTitle(event.target.value)} />
                </label>
                <label className="text-sm text-slate-700">
                  Department
                  <input required minLength={2} className="field" value={department} onChange={(event) => setDepartment(event.target.value)} />
                </label>
                <label className="text-sm text-slate-700">
                  Required by
                  <input type="date" className="field" value={requiredBy} onChange={(event) => setRequiredBy(event.target.value)} />
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="pb-2">Item</th>
                      <th className="pb-2">Qty</th>
                      <th className="pb-2">Unit</th>
                      <th className="pb-2">Est. unit price (UGX)</th>
                      <th className="pb-2 text-right">Line total</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={index} className="align-top">
                        <td className="pr-2"><input className="field" value={line.name} onChange={(event) => updateLine(index, { name: event.target.value })} placeholder="e.g. A4 paper ream" /></td>
                        <td className="w-24 pr-2"><input type="number" min={0} step="any" className="field" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} /></td>
                        <td className="w-28 pr-2"><input className="field" value={line.unit} onChange={(event) => updateLine(index, { unit: event.target.value })} placeholder="ream" /></td>
                        <td className="w-44 pr-2"><input type="number" min={0} step="any" className="field" value={line.estimatedUnitPrice} onChange={(event) => updateLine(index, { estimatedUnitPrice: event.target.value })} /></td>
                        <td className="w-36 pt-3 text-right font-medium text-slate-900">{formatMoney(totals.lineTotals[index])}</td>
                        <td className="w-10 pt-2 text-right">
                          {lines.length > 1 && (
                            <button type="button" aria-label="Remove item" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={() => setLines((current) => current.filter((_, position) => position !== index))}>×</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setLines((current) => [...current, emptyLine()])}>Add item</button>

              <dl className="ml-auto grid max-w-sm gap-1 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd>{formatMoney(totals.subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">VAT ({VAT_RATE * 100}%)</dt><dd>{formatMoney(totals.tax)}</dd></div>
                <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900"><dt>Estimated budget</dt><dd>{formatMoney(totals.total)}</dd></div>
              </dl>

              <div className="flex flex-wrap justify-end gap-2">
                <button type="submit" value="draft" className="btn-secondary" disabled={busy === 'create'}>Save draft</button>
                <button type="submit" value="submit" className="btn-primary" disabled={busy === 'create'}>Save &amp; submit</button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="card p-6 text-sm text-slate-500">Loading purchase requests…</div>
          ) : requests.length === 0 ? (
            <div className="card p-6 text-sm text-slate-500">No purchase requests yet. Create your first request to start the workflow.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {requests.map((item) => (
                <article key={item.id} className="card flex flex-col p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-slate-900">{item.requestNumber}</span>
                    <span className={`badge ${statusTone(item.status)}`}>{item.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.department ?? 'No department'} · {item.items.length} item{item.items.length === 1 ? '' : 's'} · needed {formatDate(item.requiredBy)}
                  </p>
                  {(item.sourceRequest || item.template) && (
                    <p className="mt-1 text-xs text-slate-500">
                      {item.template ? `From template "${item.template.name}"` : `Repeat of ${item.sourceRequest!.requestNumber}`}
                    </p>
                  )}
                  <p className="mt-3 text-lg font-semibold text-slate-900">
                    {item.estimatedBudget ? formatMoney(item.estimatedBudget, item.currency) : 'Budget pending'}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.status === 'DRAFT' && (
                      <button type="button" className="btn-primary" disabled={busy === item.id} onClick={() => run(item.id, `${item.requestNumber} submitted.`, () => apiFetch(`/purchase-requests/${item.id}/submit`, { method: 'POST', body: JSON.stringify({}) }))}>
                        Submit
                      </button>
                    )}
                    {item.status === 'SUBMITTED' && (
                      <button type="button" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy === item.id} onClick={() => run(item.id, `${item.requestNumber} approved.`, () => apiFetch(`/purchase-requests/${item.id}/approve`, { method: 'POST', body: JSON.stringify({}) }))}>
                        Approve
                      </button>
                    )}
                    <button type="button" className="btn-secondary" disabled={busy === item.id} onClick={() => run(item.id, `New draft created from ${item.requestNumber} with the latest prices paid.`, () => apiFetch(`/purchase-requests/${item.id}/repeat`, { method: 'POST', body: JSON.stringify({}) }))}>
                      Repeat
                    </button>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Template name"
                      value={templateName[item.id] ?? ''}
                      onChange={(event) => setTemplateName((current) => ({ ...current, [item.id]: event.target.value }))}
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busy === item.id || !(templateName[item.id] ?? '').trim()}
                      onClick={async () => {
                        const name = templateName[item.id].trim();
                        const ok = await run(item.id, `Saved as template "${name}".`, () => apiFetch('/templates', { method: 'POST', body: JSON.stringify({ name, sourceRequestId: item.id }) }));
                        if (ok) setTemplateName((current) => ({ ...current, [item.id]: '' }));
                      }}
                    >
                      Save as template
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
