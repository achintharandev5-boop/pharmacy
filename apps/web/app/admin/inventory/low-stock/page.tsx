'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { TriangleAlert, Truck, ArrowRight } from 'lucide-react';
import { getInventoryLowStock } from '@/app/actions/inventory';
import PageHeader from '@/components/admin/PageHeader';
import InventoryTabs from '@/components/admin/InventoryTabs';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';

export default function LowStockReorderPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLowStock() {
      setLoading(true);
      try {
        const data = await getInventoryLowStock();
        if (Array.isArray(data)) setItems(data);
      } catch (err) {
        console.error('Failed to load low stock system:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLowStock();
  }, []);

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      <PageHeader
        title="Low Stock & Reorder Suggestions"
        subtitle="Medicines at or below reorder levels, calculated replenishment quantities, and supplier shortcuts."
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

      {/* REORDER SUGGESTION TABLE */}
      <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#0F172A]">Reorder Priority Action Queue</h2>
          <span className="text-xs font-semibold text-slate-500">
            Suggested Formula: Max Stock - Current Stock
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Medicine</th>
                <th className="py-3.5 px-4 font-mono">Barcode</th>
                <th className="py-3.5 px-4 text-center">Current Stock</th>
                <th className="py-3.5 px-4 text-center">Reorder Threshold</th>
                <th className="py-3.5 px-4 text-center">Suggested Order</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                    <div className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading low stock recommendations...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((it) => (
                  <tr key={it.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {it.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-500">
                      {it.barcode || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-center text-rose-600">
                      {it.stock_quantity ?? it.remaining ?? 0}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-center text-slate-600">
                      {it.reorder_level || 15}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-center text-[#2563EB]">
                      +{Math.max(50, (it.reorder_level || 15) * 4 - (it.stock_quantity || 0))} units
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={(it.stock_quantity ?? 0) <= 0 ? 'Out of Stock' : 'Low Stock'} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/admin/inventory/receiving?product=${encodeURIComponent(it.name)}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white font-bold rounded-xl text-xs transition-all shadow-xs hover:brightness-105"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Order</span>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="All items healthy"
                      description="No products are currently at or below the low stock threshold."
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
