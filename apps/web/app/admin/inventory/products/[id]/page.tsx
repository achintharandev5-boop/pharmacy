'use client';

import type { ApiData } from '@/lib/api/types';
import React, { useState, use } from 'react';
import Link from 'next/link';
import { Package, ArrowLeft, Boxes, History } from 'lucide-react';
import { getAdminProductById } from '@/app/actions/admin';
import PageHeader from '@/components/admin/PageHeader';
import InventoryTabs from '@/components/admin/InventoryTabs';
import FilterTabs from '@/components/admin/FilterTabs';
import StatusBadge from '@/components/admin/StatusBadge';
import { ErrorState, LoadingState, MISSING } from '@/components/admin/DataState';
import { useApiQuery } from '@/lib/useApiQuery';

function formatLkr(value: unknown) {
  return value !== undefined && value !== null && Number.isFinite(Number(value)) ? `LKR ${Number(value).toFixed(2)}` : MISSING;
}

export default function Product360Page({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const productId = resolvedParams.id;

  const [activeTab, setActiveTab] = useState<'overview' | 'movements'>('overview');
  const productQuery = useApiQuery(() => getAdminProductById(productId), [productId]);

  if (productQuery.status === 'loading') {
    return <LoadingState label="Loading product…" />;
  }

  if (productQuery.status === 'error') {
    return (
      <div className="space-y-4 select-none font-sans">
        <Link href="/admin/inventory/products" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" />
          Back to products
        </Link>
        <div className="bg-white rounded-2xl border border-slate-200">
          <ErrorState title="Could not load product" message={productQuery.error} onRetry={productQuery.retry} />
        </div>
      </div>
    );
  }

  const data = productQuery.data;
  const p = data.product ?? data;
  const batches: ApiData[] = Array.isArray(data.batches) ? data.batches : [];
  const movements: ApiData[] = Array.isArray(data.movements) ? data.movements : [];
  const stock = typeof p.stock_quantity === 'number' ? p.stock_quantity : null;
  const reorderLevel = typeof p.reorder_level === 'number' ? p.reorder_level : null;

  let stockStatus: string | null = null;
  if (stock !== null) {
    if (stock <= 0) stockStatus = 'Out of Stock';
    else if (reorderLevel !== null && stock <= reorderLevel) stockStatus = 'Low Stock';
    else stockStatus = 'In Stock';
  }

  const subtitle = [p.generic_name, p.category, p.barcode ? `Barcode: ${p.barcode}` : null].filter(Boolean).join(' • ');

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      <PageHeader
        title={p.name || MISSING}
        subtitle={subtitle || undefined}
        icon={Package}
        badge={p.category}
        actions={
          p.name
            ? [
                {
                  label: 'Receive Stock (GRN)',
                  href: `/admin/inventory/receiving?product=${encodeURIComponent(p.name)}`,
                  variant: 'primary',
                },
              ]
            : []
        }
      />

      <InventoryTabs />

      {/* METRIC TILES */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.02)] space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Inventory</span>
          <span className="text-2xl font-extrabold text-[#0F172A] block">{stock !== null ? `${stock} units` : MISSING}</span>
          {stockStatus && <StatusBadge status={stockStatus} />}
        </div>

        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.02)] space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Retail Price</span>
          <span className="text-2xl font-extrabold text-[#2563EB] block">{formatLkr(p.unit_price ?? p.retail_price)}</span>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.02)] space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Purchase Cost</span>
          <span className="text-2xl font-extrabold text-slate-800 block">{formatLkr(p.purchase_cost)}</span>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.02)] space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reorder Level</span>
          <span className="text-2xl font-extrabold text-amber-600 block">
            {reorderLevel !== null ? `${reorderLevel} units` : MISSING}
          </span>
        </div>
      </div>

      {/* SUB-TABS */}
      <div className="bg-white/88 backdrop-blur-md p-2 rounded-2xl border border-slate-200/70 shadow-[0_2px_10px_rgba(15,23,42,0.02)]">
        <FilterTabs
          tabs={[
            { id: 'overview', label: 'Batch Details' },
            { id: 'movements', label: 'Movement History' },
          ]}
          activeTab={activeTab}
          onChange={(tab: ApiData) => setActiveTab(tab)}
        />
      </div>

      {activeTab === 'overview' && (
        <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] p-5 space-y-4">
          <h2 className="text-base font-bold text-[#0F172A] border-b border-slate-100 pb-3 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-[#2563EB]" />
            <span>Batches</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3">Batch Number</th>
                  <th className="py-3 px-3 text-center">Remaining Units</th>
                  <th className="py-3 px-3">Expiry Date</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {batches.length > 0 ? (
                  batches.map((b: ApiData, i: number) => (
                    <tr key={b.id || i} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-[#2563EB]">{b.batch_number || MISSING}</td>
                      <td className="py-3 px-3 font-mono font-bold text-center text-slate-900">
                        {b.quantity_available ?? b.current_quantity ?? b.quantity ?? MISSING}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700">{b.expiry_date || MISSING}</td>
                      <td className="py-3 px-3">{b.status ? <StatusBadge status={b.status} /> : MISSING}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500 font-semibold">
                      No batches recorded for this product.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'movements' && (
        <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] p-5 space-y-4">
          <h2 className="text-base font-bold text-[#0F172A] border-b border-slate-100 pb-3 flex items-center gap-2">
            <History className="w-4 h-4 text-[#2563EB]" />
            <span>Movement History</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3 text-center">Change</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {movements.length > 0 ? (
                  movements.map((m: ApiData, i: number) => {
                    const change = typeof m.quantity_change === 'number' ? m.quantity_change : typeof m.quantity === 'number' ? m.quantity : null;
                    const isDec = change !== null && change < 0;
                    return (
                      <tr key={m.id || i} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-800">{m.movement_type || MISSING}</td>
                        <td className="py-3 px-3 font-mono font-bold text-center">
                          {change === null ? (
                            MISSING
                          ) : (
                            <span className={`px-2 py-0.5 rounded text-xs ${isDec ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {isDec ? change : `+${change}`}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600">{m.notes || m.reason || MISSING}</td>
                        <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                          {m.created_at ? new Date(m.created_at).toLocaleString() : MISSING}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500 font-semibold">
                      No movements recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
