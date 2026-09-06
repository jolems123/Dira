'use client';

import { useEffect, useState } from 'react';
import { API_BASE, getToken } from '../lib/api';

type Attachment = { id: string; originalFilename: string; documentType: string; sizeBytes: number; downloadUrl: string };

export function AttachmentUpload({ entityType, entityId, documentType, label }: { entityType: string; entityId: string; documentType: string; label: string }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch(`${API_BASE}/api/v1/documents/${entityType}/${entityId}`, { headers: { Authorization: `Bearer ${getToken() ?? ''}` } });
    if (response.ok) setItems((await response.json()).items ?? []);
  }
  useEffect(() => { load(); }, [entityType, entityId]);

  async function upload(file: File) {
    setBusy(true); setMessage(null);
    const form = new FormData();
    form.append('file', file);
    form.append('entityType', entityType);
    form.append('entityId', entityId);
    form.append('documentType', documentType);
    const response = await fetch(`${API_BASE}/api/v1/documents`, { method: 'POST', headers: { Authorization: `Bearer ${getToken() ?? ''}` }, body: form });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? `${file.name} uploaded.` : body.message ?? 'Upload failed');
    if (response.ok) await load();
    setBusy(false);
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <label className="cursor-pointer rounded-lg bg-navy px-3 py-2 text-xs font-medium text-white">
          {busy ? 'Uploading…' : 'Upload document'}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.docx" className="sr-only" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); event.currentTarget.value = ''; }} />
        </label>
      </div>
      {message && <p className="mt-2 text-xs text-slate-600">{message}</p>}
      {items.length > 0 && <ul className="mt-2 space-y-1">{items.map((item) => <li key={item.id}><a className="text-xs text-navy underline" href={`${API_BASE}${item.downloadUrl}`} target="_blank" rel="noreferrer">{item.originalFilename}</a></li>)}</ul>}
    </div>
  );
}
