'use client';

import React from 'react';
import Link from 'next/link';
import { TriangleAlert, Truck, ArrowRight } from 'lucide-react';
import { getInventoryLowStock } from '@/app/actions/inventory';
import PageHeader from '@/components/admin/PageHeader';
import InventoryTabs from '@/components/admin/InventoryTabs';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import { ErrorState, LoadingState, MISSING } from '@/components/admin/DataState';
import { useApiQuery } from '@/lib/useApiQuery';

export default function LowStockReorderPage() {
  const lowStockQuery = useApiQuery(() => getInventoryLowStock(), []);
  const items = lowStockQuery.data ?? [];

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      <PageHeader
        title="Low Stock"
        subtitle="Medicines at or below their reorder level."
        icon={TriangleAlert}
        actions={[
          {
            label: 'Receive Stock (GRN)',
            href: '/admin/inventory/receiving',
            variant: 'primary',
          },
        ]}
      />

      <InventoryTabs />

      {/* LOW STOCK TABLE */}
      <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#0F172A]">Items at or below reorder level</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Medicine</th>
                <th className="py-3.5 px-4 font-mono">Barcode</th>
                <th className="py-3.5 px-4 text-center">Current Stock</th>
                <th className="py-3.5 px-4 text-center">Reorder Level</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {lowStockQuery.status === 'loading' ? (
                <tr>
                  <td colSpan={6}>
                    <LoadingState label="Loading low stock items…" />
                  </td>
                </tr>
              ) : lowStockQuery.status === 'error' ? (
                <tr>
                  <td colSpan={6}>
                    <ErrorState title="Could not load low stock items" message={lowStockQuery.error} onRetry={lowStockQuery.retry} />
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((it) => {
                  const stock = it.stock_quantity ?? it.remaining;
                  return (
                  <tr key={it.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {it.name || MISSING}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-500">
                      {it.barcode || MISSING}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-center text-rose-600">
                      {stock ?? MISSING}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-center text-slate-600">
                      {it.reorder_level ?? MISSING}
                    </td>
                    <td className="py-3.5 px-4">
                      {typeof stock === 'number' ? (
                        <StatusBadge status={stock <= 0 ? 'Out of Stock' : 'Low Stock'} />
                      ) : (
                        MISSING
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/admin/inventory/receiving?product=${encodeURIComponent(it.name)}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white font-bold rounded-xl text-xs transition-all shadow-xs hover:brightness-105"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Receive</span>
                      </Link>
                    </td>
                  </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="No low stock items"
                      description="No products are currently at or below their reorder level."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
