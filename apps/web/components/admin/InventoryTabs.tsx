'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const INVENTORY_TABS = [
  { href: '/admin/inventory', label: 'Overview' },
  { href: '/admin/inventory/products', label: 'Products' },
  { href: '/admin/inventory/batches', label: 'Batches' },
  { href: '/admin/inventory/movements', label: 'Stock Movements' },
  { href: '/admin/inventory/suppliers', label: 'Suppliers' },
  { href: '/admin/inventory/expiry', label: 'Expiry' },
  { href: '/admin/inventory/low-stock', label: 'Low Stock' },
  { href: '/admin/inventory/adjustments', label: 'Adjustments' },
  { href: '/admin/inventory/analytics', label: 'Analytics' },
];

export default function InventoryTabs() {
  const pathname = usePathname();

  return (
    <div className="bg-white/88 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/70 shadow-[0_2px_10px_rgba(15,23,42,0.02)] overflow-x-auto select-none">
      <div className="flex items-center gap-1 min-w-max">
        {INVENTORY_TABS.map((tab, idx) => {
          const isActive =
            tab.href === '/admin/inventory'
              ? pathname === '/admin/inventory'
              : pathname === tab.href || pathname.startsWith(tab.href + '/');

          return (
            <Link
              key={idx}
              href={tab.href}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 ${
                isActive
                  ? 'bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
