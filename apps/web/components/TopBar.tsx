import { Bell, ChevronDown, Search, Plus, Menu, Sparkles } from 'lucide-react';

export function TopBar() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button className="rounded-xl border border-slate-200 p-2 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 md:flex">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Buy mode
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3">
          <div className="hidden min-w-[220px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 md:flex">
            <Search className="h-4 w-4" />
            Search suppliers, orders, invoices
          </div>

          <button className="nav-chip">
            <Plus className="h-4 w-4" />
            Create purchase request
          </button>

          <button className="relative rounded-xl border border-slate-200 p-2">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-600" />
          </button>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">DB</div>
            <div className="hidden text-left sm:block">
              <div className="text-sm font-medium text-slate-900">Demo Buyer</div>
              <div className="text-xs text-slate-500">Dira Procurement</div>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </div>
        </div>
      </div>
    </header>
  );
}
