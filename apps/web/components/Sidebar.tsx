'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, BriefcaseBusiness, Building2, FileCheck2, Home, PackageCheck, PackageSearch, ReceiptText, ShieldCheck, Warehouse } from 'lucide-react';
import { apiFetch } from '../lib/api';

const buyerItems = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Purchase Requests', href: '/purchase-requests', icon: BriefcaseBusiness },
  { label: 'RFQs', href: '/rfqs', icon: PackageSearch },
  { label: 'Quotes', href: '/quotes', icon: ReceiptText },
  { label: 'Orders & deliveries', href: '/orders', icon: PackageCheck },
  { label: 'Invoices', href: '/invoices', icon: FileCheck2 },
  { label: 'Exceptions', href: '/exceptions', icon: ShieldCheck },
  { label: 'Suppliers', href: '/suppliers', icon: Building2 },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
];

const supplierItems = [
  { label: 'Supplier portal', href: '/supplier', icon: Warehouse },
  { label: 'Quotes', href: '/quotes', icon: ReceiptText },
  { label: 'Orders & deliveries', href: '/orders', icon: PackageCheck },
  { label: 'Invoices', href: '/invoices', icon: FileCheck2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isSupplier, setIsSupplier] = useState(false);

  useEffect(() => {
    apiFetch<{ organization: { type: string } | null }>('/auth/me')
      .then((data) => setIsSupplier(data.organization?.type === 'SUPPLIER'))
      .catch(() => setIsSupplier(false));
  }, []);

  const items = isSupplier ? supplierItems : buyerItems;

  return (
    <aside className="hidden min-h-screen w-72 border-r border-slate-200 bg-slate-50 p-5 lg:block">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-navy text-2xl font-bold text-white">d</div>
        <div>
          <div className="text-xl font-bold text-navy">Dira</div>
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">procurement</div>
        </div>
      </div>

      <nav className="space-y-2">
        {items.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={label}
              href={href}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                active ? 'bg-white text-navy shadow-sm' : 'text-slate-700 hover:bg-white hover:text-navy'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 rounded-2xl bg-navy p-4 text-white">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4" />
          Verified supply network
        </div>
        <p className="text-xs text-slate-300">Buyer and supplier workflows stay connected with approval and verification checks.</p>
      </div>
    </aside>
  );
}
