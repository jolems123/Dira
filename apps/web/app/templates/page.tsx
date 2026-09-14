'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { TopBar } from '../../components/TopBar';
import { ApiError, apiFetch, formatDate, formatMoney } from '../../lib/api';
import { calculateTotals, toNumber } from '../../lib/calc';

type TemplateItem = { id: string; name: string; quantity: string; unit: string | null; estimatedUnitPrice: string | null };

type Template = {
  id: string;
  name: string;
  title: string;
  department: string | null;
  currency: string;
  leadTimeDays: number | null;
  preferredSupplierIds: string[];
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | null;
  scheduleActive: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  items: TemplateItem[];
  _count: { purchaseRequests: number };
};

type Supplier = { id: string; legalName: string; tradingName?: string | null };

type ScheduleDraft = { frequency: string; nextRunAt: string; leadTimeDays: string };

const FREQUENCY_LABEL: Record<string, string> = { WEEKLY: 'Every week', MONTHLY: 'Every month', QUARTERLY: 'Every quarter' };

/** `<input type="datetime-local">` wants local wall-clock time without a zone. */
function toLocalInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ScheduleDraft>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    try {
      const [templateData, supplierData] = await Promise.all([
        apiFetch<{ items: Template[] }>('/templates'),
        apiFetch<{ items: Supplier[] }>('/suppliers'),
      ]);
      setTemplates(templateData.items ?? []);
      setSuppliers(supplierData.items ?? []);
      setDrafts(Object.fromEntries((templateData.items ?? []).map((template) => [template.id, {
        frequency: template.frequency ?? 'MONTHLY',
        nextRunAt: toLocalInput(template.nextRunAt),
        leadTimeDays: template.leadTimeDays === null ? '' : String(template.leadTimeDays),
      }])));
      setError(null);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to load templates');
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
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  const patch = (id: string, body: unknown) => apiFetch(`/templates/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  const supplierName = (id: string) => {
    const supplier = suppliers.find((candidate) => candidate.id === id);
    return supplier ? supplier.tradingName ?? supplier.legalName : 'Unknown supplier';
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <TopBar />
        <main className="space-y-6 p-4 sm:p-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Repeat purchasing</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Templates &amp; schedules</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Save any purchase request as a template from the Purchase requests page. Use it to draft a new request in one click,
              or schedule it so Dira drafts one automatically. Drafts use the most recent prices you paid and still go through approval.
            </p>
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
          {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>}

          {loading ? (
            <div className="card p-6 text-sm text-slate-500">Loading templates…</div>
          ) : templates.length === 0 ? (
            <div className="card p-6 text-sm text-slate-500">
              No templates yet. Open Purchase requests, type a name under a request and choose “Save as template”.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {templates.map((template) => {
                const draft = drafts[template.id];
                const estimate = calculateTotals({ lines: template.items.map((item) => ({ quantity: toNumber(item.quantity), unitPrice: toNumber(item.estimatedUnitPrice) })) });
                return (
                  <article key={template.id} className="card space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-slate-900">{template.name}</h2>
                        <p className="text-sm text-slate-600">{template.title} · {template.department ?? 'No department'}</p>
                        <p className="text-xs text-slate-500">Used {template._count.purchaseRequests} time{template._count.purchaseRequests === 1 ? '' : 's'} · last run {formatDate(template.lastRunAt)}</p>
                      </div>
                      <span className={`badge ${template.scheduleActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                        {template.scheduleActive && template.frequency ? FREQUENCY_LABEL[template.frequency] : 'Not scheduled'}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[420px] text-left text-sm">
                        <thead className="text-xs uppercase text-slate-500">
                          <tr><th className="pb-1">Item</th><th className="pb-1 text-right">Qty</th><th className="pb-1 text-right">Est. unit price</th></tr>
                        </thead>
                        <tbody>
                          {template.items.map((item) => (
                            <tr key={item.id} className="border-t border-slate-100">
                              <td className="py-1 text-slate-900">{item.name}</td>
                              <td className="py-1 text-right text-slate-700">{Number(item.quantity)} {item.unit ?? ''}</td>
                              <td className="py-1 text-right text-slate-700">{item.estimatedUnitPrice ? formatMoney(item.estimatedUnitPrice, template.currency) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="mt-2 text-right text-sm text-slate-600">
                        Estimated per request incl. VAT: <span className="font-semibold text-slate-900">{formatMoney(estimate.total, template.currency)}</span>
                      </p>
                    </div>

                    {template.preferredSupplierIds.length > 0 && (
                      <p className="text-xs text-slate-600">
                        Suppliers pre-selected on RFQs: {template.preferredSupplierIds.map(supplierName).join(', ')}
                      </p>
                    )}

                    {draft && (
                      <div className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-3">
                        <label className="text-xs text-slate-600">
                          Repeat
                          <select className="field" value={draft.frequency} onChange={(event) => setDrafts((current) => ({ ...current, [template.id]: { ...draft, frequency: event.target.value } }))}>
                            {Object.entries(FREQUENCY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </label>
                        <label className="text-xs text-slate-600">
                          Next draft on
                          <input type="datetime-local" className="field" value={draft.nextRunAt} onChange={(event) => setDrafts((current) => ({ ...current, [template.id]: { ...draft, nextRunAt: event.target.value } }))} />
                        </label>
                        <label className="text-xs text-slate-600">
                          Needed within (days)
                          <input type="number" min={0} max={365} className="field" value={draft.leadTimeDays} onChange={(event) => setDrafts((current) => ({ ...current, [template.id]: { ...draft, leadTimeDays: event.target.value } }))} />
                        </label>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-primary" disabled={busy === template.id} onClick={() => run(template.id, `Draft request created from "${template.name}".`, () => apiFetch(`/templates/${template.id}/requests`, { method: 'POST', body: JSON.stringify({}) }))}>
                        Draft request now
                      </button>
                      {draft && (
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={busy === template.id}
                          onClick={() => run(template.id, template.scheduleActive ? 'Schedule updated.' : 'Schedule activated.', () => patch(template.id, {
                            frequency: draft.frequency,
                            scheduleActive: true,
                            nextRunAt: draft.nextRunAt ? new Date(draft.nextRunAt).toISOString() : null,
                            leadTimeDays: draft.leadTimeDays === '' ? null : toNumber(draft.leadTimeDays),
                          }))}
                        >
                          {template.scheduleActive ? 'Save schedule' : 'Activate schedule'}
                        </button>
                      )}
                      {template.scheduleActive && (
                        <button type="button" className="btn-secondary" disabled={busy === template.id} onClick={() => run(template.id, 'Schedule paused.', () => patch(template.id, { scheduleActive: false }))}>
                          Pause
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                        disabled={busy === template.id}
                        onClick={() => {
                          if (window.confirm(`Delete template "${template.name}"? Requests already drafted from it are kept.`)) {
                            run(template.id, 'Template deleted.', () => apiFetch(`/templates/${template.id}`, { method: 'DELETE' }));
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
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
