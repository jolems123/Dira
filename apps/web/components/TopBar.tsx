'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, LogOut, Search, Plus, Menu, Sparkles } from 'lucide-react';
import { apiFetch, setToken } from '../lib/api';

type Identity = {
  user: { firstName?: string; lastName?: string; email: string; role?: string };
  organization: { name: string; type: string } | null;
};

export function TopBar() {
  const router = useRouter();
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    apiFetch<Identity>('/auth/me')
      .then(setIdentity)
      .catch(() => setIdentity(null));
  }, []);

  function signOut() {
    apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setToken(null);
    router.push('/login');
  }

  const name = identity
    ? [identity.user.firstName, identity.user.lastName].filter(Boolean).join(' ') || identity.user.email
    : '—';
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const isSupplier = identity?.organization?.type === 'SUPPLIER';

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Menu" className="rounded-xl border border-slate-200 p-2 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 md:flex">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            {isSupplier ? 'Supply mode' : 'Buy mode'}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          <div className="hidden min-w-[220px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 xl:flex">
            <Search className="h-4 w-4" />
            Search suppliers, orders, invoices
          </div>

          {!isSupplier && (
            <Link href="/purchase-requests" className="nav-chip hidden sm:inline-flex">
              <Plus className="h-4 w-4" />
              Create purchase request
            </Link>
          )}

          <Link href="/exceptions" aria-label="Exceptions" className="relative rounded-xl border border-slate-200 p-2">
            <Bell className="h-5 w-5" />
          </Link>

          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
              {initials || '·'}
            </div>
            <div className="hidden min-w-0 text-left sm:block">
              <div className="truncate text-sm font-medium text-slate-900">{name}</div>
              <div className="truncate text-xs text-slate-500">{identity?.organization?.name ?? '—'}</div>
            </div>
            <button type="button" onClick={signOut} aria-label="Sign out" className="rounded-lg p-1 text-slate-500 hover:text-slate-900">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
