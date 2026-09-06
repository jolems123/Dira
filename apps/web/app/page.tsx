'use client';

import { ArrowRight, CheckCircle2, Clock3, Package, Percent, ShieldCheck, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DashboardCard } from '../components/DashboardCard';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';

export default function HomePage() {
  const [overview, setOverview] = useState<{ openRfqs: number; invoicesDue: number; purchaseRequests: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const token = window.localStorage.getItem('dira_access_token');
    if (!token) {
      setError('Sign in to view your procurement workspace.');
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/analytics/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load dashboard data');
        return response.json();
      })
      .then(setOverview)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load dashboard data'));
  }, []);
  const cards = [
    { title: 'Open RFQs', value: overview ? String(overview.openRfqs) : '—', detail: 'Live', accent: 'navy' as const },
    { title: 'Purchase requests', value: overview ? String(overview.purchaseRequests) : '—', detail: 'Live', accent: 'green' as const },
    { title: 'Awaiting approval', value: '—', detail: 'Live', accent: 'amber' as const },
    { title: 'Invoices due', value: overview ? String(overview.invoicesDue) : '—', detail: 'Live', accent: 'red' as const },
  ];
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1">
        <TopBar />
        <main className="space-y-6 p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Buyer dashboard</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">What needs your attention today?</h1>
            </div>
            <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 font-medium text-white shadow-soft">
              <Package className="h-4 w-4" />
              Create purchase request
            </button>
          </div>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <DashboardCard key={card.title} {...card} />
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Recent purchasing activity</h2>
                <button className="text-sm font-medium text-navy">View all</button>
              </div>

              {error ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div> : (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                  {overview ? 'Your latest procurement activity will appear here.' : 'Loading live procurement activity...'}
                </div>
              )}
            </div>

            <div className="card p-5">
              <h2 className="text-lg font-semibold text-slate-900">Urgent actions</h2>
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-900"><Clock3 className="h-4 w-4" /> Quote deadline in 12 hours</div>
                  <p className="mt-2 text-sm text-amber-800">Review 3 supplier quotations for IT equipment.</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><CheckCircle2 className="h-4 w-4" /> Approval granted</div>
                  <p className="mt-2 text-sm text-emerald-800">Laptop refresh request approved by finance.</p>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-sky-900"><ShieldCheck className="h-4 w-4" /> Supplier verification</div>
                  <p className="mt-2 text-sm text-sky-800">One supplier document is ready for review.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Spend by category</h3><Percent className="h-4 w-4 text-slate-400" /></div>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex justify-between"><span>ICT & electronics</span><strong className="text-slate-900">P280k</strong></li>
                <li className="flex justify-between"><span>Construction materials</span><strong className="text-slate-900">P230k</strong></li>
                <li className="flex justify-between"><span>Office & stationery</span><strong className="text-slate-900">P135k</strong></li>
              </ul>
            </div>
            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Delivery performance</h3><Truck className="h-4 w-4 text-slate-400" /></div>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex justify-between"><span>On-time delivery</span><strong className="text-green-700">96%</strong></div>
                <div className="flex justify-between"><span>Late deliveries</span><strong className="text-amber-700">03%</strong></div>
                <div className="flex justify-between"><span>Rejected goods</span><strong className="text-red-700">01%</strong></div>
              </div>
            </div>
            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Supplier health</h3><ShieldCheck className="h-4 w-4 text-slate-400" /></div>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex justify-between"><span>Verified suppliers</span><strong className="text-slate-900">86</strong></div>
                <div className="flex justify-between"><span>Pending reviews</span><strong className="text-slate-900">08</strong></div>
                <div className="flex justify-between"><span>High-risk vendors</span><strong className="text-red-700">02</strong></div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
