'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Boxes, Barcode, Truck, Plus, TriangleAlert, History } from 'lucide-react';
import {
  getInventorySummary,
  getInventoryAlerts,
  getInventoryMovements,
} from '@/app/actions/inventory';
import InventoryTabs from '@/components/admin/InventoryTabs';
import { ErrorState, LoadingState, MISSING } from '@/components/admin/DataState';
import { useApiQuery } from '@/lib/useApiQuery';

function formatNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : MISSING;
}

function formatLkrMillions(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? `LKR ${(value / 1_000_000).toFixed(1)}M` : MISSING;
}

export default function PharmacyInventoryDashboardPage() {
  const router = useRouter();
  const [barcodeSearch, setBarcodeSearch] = useState('');

  const summaryQuery = useApiQuery(() => getInventorySummary(), []);
  const alertsQuery = useApiQuery(() => getInventoryAlerts(), []);
  const movementsQuery = useApiQuery(() => getInventoryMovements(undefined, undefined), []);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = barcodeSearch.trim();
    if (!term) return;
    router.push(`/admin/inventory/products?query=${encodeURIComponent(term)}`);
  };

  const summary = summaryQuery.data;
  const alerts = alertsQuery.data ?? [];
  const movements = (movementsQuery.data ?? []).slice(0, 5);

  const kpis = [
    { label: 'Total Products', value: formatNumber(summary?.totalProducts), note: 'Products in catalog', tone: 'slate' },
    {
      label: 'Stock Units',
      value: formatNumber(summary?.totalUnits),
      note: typeof summary?.stock?.healthy === 'number' ? `${summary.stock.healthy} products above reorder level` : 'Units on hand',
      tone: 'slate',
    },
    { label: 'Low Stock', value: formatNumber(summary?.stock?.low), note: 'At or below reorder level', tone: 'amber' },
    { label: 'Out of Stock', value: formatNumber(summary?.stock?.outOfStock), note: 'No units on hand', tone: 'rose' },
    { label: 'Expiring Soon', value: formatNumber(summary?.expiry?.within30Days), note: 'Next 30 days', tone: 'purple' },
    { label: 'Inventory Value', value: formatLkrMillions(summary?.valuation?.retail), note: 'Retail valuation', tone: 'slate' },
  ] as const;

  const toneClasses: Record<string, { border: string; label: string; value: string; note: string }> = {
    slate: { border: 'border-slate-200/70', label: 'text-slate-400', value: 'text-[#0F172A]', note: 'text-slate-500' },
    amber: { border: 'border-amber-200/80', label: 'text-amber-700', value: 'text-amber-600', note: 'text-amber-700' },
    rose: { border: 'border-rose-200/80', label: 'text-rose-700', value: 'text-rose-600', note: 'text-rose-700' },
    purple: { border: 'border-purple-200/80', label: 'text-purple-700', value: 'text-purple-600', note: 'text-purple-700' },
  };

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {/* HEADER BAR WITH ACTIONS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/88 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shrink-0 shadow-xs">
            <Boxes className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">
              Pharmacy Inventory Management
            </h1>
            <p className="text-xs sm:text-[13px] font-medium text-[#64748B] mt-0.5">
              Monitor medicine stock, batches, expiry dates, suppliers, and inventory movements
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Barcode Search Form */}
          <form onSubmit={handleBarcodeSubmit} className="relative w-full sm:w-56" role="search">
            <Barcode className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={barcodeSearch}
              onChange={(e) => setBarcodeSearch(e.target.value)}
              placeholder="Scan Barcode / SKU..."
              aria-label="Search products by barcode or SKU"
              className="w-full h-[40px] pl-9 pr-3 bg-[#F8FBFF] border border-slate-200 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 rounded-xl text-xs font-mono font-bold outline-none transition-all placeholder:text-slate-400"
            />
          </form>

          <Link
            href="/admin/inventory/receiving"
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs transition-colors shadow-2xs"
          >
            <Truck className="w-4 h-4 text-[#2563EB]" />
            <span>Receive Stock (GRN)</span>
          </Link>

          <Link
            href="/admin/inventory/products"
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white font-bold text-xs shadow-xs hover:brightness-105 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      <InventoryTabs />

      {/* INVENTORY KPI CARDS */}
      {summaryQuery.status === 'error' ? (
        <div className="bg-white rounded-2xl border border-slate-200">
          <ErrorState
            title="Could not load inventory summary"
            message={summaryQuery.error}
            onRetry={summaryQuery.retry}
            compact
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5" aria-busy={summaryQuery.status === 'loading'}>
          {kpis.map((kpi) => {
            const tone = toneClasses[kpi.tone];
            return (
              <div
                key={kpi.label}
                className={`bg-white/90 backdrop-blur-md p-4 rounded-2xl border ${tone.border} shadow-[0_4px_20px_rgba(15,23,42,0.02)]`}
              >
                <span className={`text-[11px] font-bold uppercase tracking-wider block ${tone.label}`}>{kpi.label}</span>
                <span className={`text-2xl font-extrabold mt-1 block ${tone.value}`}>
                  {summaryQuery.status === 'loading' ? (
                    <span className="inline-block h-7 w-16 rounded bg-slate-100 animate-pulse" aria-hidden="true" />
                  ) : (
                    kpi.value
                  )}
                </span>
                <span className={`text-[11px] font-semibold mt-1 block ${tone.note}`}>{kpi.note}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* INVENTORY ALERTS & MOVEMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Alerts (7 cols) */}
        <div className="lg:col-span-7 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <TriangleAlert className="w-4 h-4 text-amber-500" />
              <span>Inventory Alerts</span>
            </h2>
            <Link href="/admin/inventory/expiry" className="text-xs font-bold text-[#2563EB] hover:underline">
              View Expiry &rarr;
            </Link>
          </div>

          <div className="space-y-2.5">
            {alertsQuery.status === 'loading' ? (
              <LoadingState label="Loading alerts…" />
            ) : alertsQuery.status === 'error' ? (
              <ErrorState title="Could not load alerts" message={alertsQuery.error} onRetry={alertsQuery.retry} compact />
            ) : alerts.length > 0 ? (
              alerts.map((alt, i) => {
                const isCritical = alt.type === 'EXPIRED' || alt.type === 'OUT_OF_STOCK';
                return (
                  <div
                    key={alt.id || i}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                      isCritical
                        ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                        : 'bg-amber-50/70 border-amber-200 text-amber-950'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {alt.type && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${
                            isCritical ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
                          }`}
                        >
                          {String(alt.type).replace(/_/g, ' ')}
                        </span>
                      )}
                      <div className="truncate">
                        <span className="font-bold text-[#0F172A] block leading-tight truncate">{alt.title || MISSING}</span>
                        {alt.message && (
                          <span className="text-[11px] text-slate-600 block mt-0.5 truncate">{alt.message}</span>
                        )}
                      </div>
                    </div>

                    {alt.href && (
                      <Link
                        href={alt.href}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors shadow-2xs ${
                          isCritical
                            ? 'bg-white hover:bg-rose-50 text-rose-700 border border-rose-300'
                            : 'bg-white hover:bg-amber-50 text-amber-700 border border-amber-300'
                        }`}
                      >
                        {alt.actionLabel || 'Review'}
                      </Link>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-center text-slate-500 py-6 text-xs font-semibold">No inventory alerts.</p>
            )}
          </div>
        </div>

        {/* Recent Stock Movements (5 cols) */}
        <div className="lg:col-span-5 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <History className="w-4 h-4 text-[#2563EB]" />
              <span>Recent Movements</span>
            </h2>
            <Link href="/admin/inventory/movements" className="text-xs font-bold text-[#2563EB] hover:underline">
              All Movements &rarr;
            </Link>
          </div>

          <div className="space-y-2">
            {movementsQuery.status === 'loading' ? (
              <LoadingState label="Loading movements…" />
            ) : movementsQuery.status === 'error' ? (
              <ErrorState title="Could not load movements" message={movementsQuery.error} onRetry={movementsQuery.retry} compact />
            ) : movements.length > 0 ? (
              movements.map((mov, i) => (
                <div
                  key={mov.id || i}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-slate-800 block truncate">
                      {mov.product?.name || mov.product_name || MISSING}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {mov.created_at
                        ? new Date(mov.created_at).toLocaleString([], {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : MISSING}
                    </span>
                  </div>
                  {typeof mov.quantity_change === 'number' ? (
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                        mov.quantity_change < 0
                          ? 'bg-rose-50 text-rose-600 border border-rose-100'
                          : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      }`}
                    >
                      {mov.quantity_change < 0 ? mov.quantity_change : `+${mov.quantity_change}`}
                    </span>
                  ) : (
                    <span className="text-slate-400">{MISSING}</span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-slate-500 py-6 text-xs font-semibold">No stock movements recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
