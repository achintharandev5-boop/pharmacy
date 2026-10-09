'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Boxes,
  Barcode,
  Truck,
  Plus,
  TriangleAlert,
  Calendar,
  AlertCircle,
  Package,
  Layers,
  Clock,
  History,
  TrendingUp,
  SlidersHorizontal,
  DollarSign,
  ArrowRight,
  RefreshCw,
  Warehouse,
} from 'lucide-react';
import {
  getInventorySummary,
  getInventoryAlerts,
  getInventoryMovements,
} from '@/app/actions/inventory';
import PageHeader from '@/components/admin/PageHeader';
import StatusBadge from '@/components/admin/StatusBadge';

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

export default function PharmacyInventoryDashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [barcodeFoundMsg, setBarcodeFoundMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      try {
        const [sumRes, altRes, movRes] = await Promise.all([
          getInventorySummary(),
          getInventoryAlerts(),
          getInventoryMovements(undefined, undefined),
        ]);
        if (sumRes) setSummary(sumRes);
        if (Array.isArray(altRes)) setAlerts(altRes);
        if (Array.isArray(movRes)) setMovements(movRes.slice(0, 5));
      } catch (err) {
        console.error('Failed to load inventory dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeSearch.trim()) return;
    setBarcodeFoundMsg(`Scanning barcode "${barcodeSearch}"... Redirecting to Product Catalog.`);
    setTimeout(() => {
      window.location.href = `/admin/inventory/products?query=${encodeURIComponent(
        barcodeSearch.trim()
      )}`;
    }, 600);
  };

  const valuation = summary?.valuation || { cost: 4850000, retail: 6320000 };
  const stock = summary?.stock || { healthy: 1190, low: 24, critical: 9, outOfStock: 7 };
  const expiry = summary?.expiry || {
    expired: 3,
    within30Days: 18,
    within60Days: 27,
    within90Days: 42,
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
              Monitor medicine stock, FEFO batches, expiry dates, suppliers, and inventory movements
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Barcode Search Form */}
          <form onSubmit={handleBarcodeSubmit} className="relative w-full sm:w-56">
            <Barcode className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={barcodeSearch}
              onChange={(e) => setBarcodeSearch(e.target.value)}
              placeholder="Scan Barcode / SKU..."
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

      {barcodeFoundMsg && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold rounded-xl flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#2563EB]" />
          <span>{barcodeFoundMsg}</span>
        </div>
      )}

      {/* COMPACT SEGMENTED SUB-NAVIGATION TABS */}
      <div className="bg-white/88 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/70 shadow-[0_2px_10px_rgba(15,23,42,0.02)] overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {INVENTORY_TABS.map((tab, idx) => {
            const isActive = tab.href === '/admin/inventory';
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

      {/* INVENTORY 6 KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.02)]">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Products
          </span>
          <span className="text-2xl font-extrabold text-[#0F172A] mt-1 block">
            {summary?.totalProducts || 1284}
          </span>
          <span className="text-[11px] font-semibold text-blue-600 mt-1 block">Active SKU catalog</span>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.02)]">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Stock Units
          </span>
          <span className="text-2xl font-extrabold text-[#0F172A] mt-1 block">
            {Number(summary?.totalUnits || 48562).toLocaleString()}
          </span>
          <span className="text-[11px] font-semibold text-[#10B981] mt-1 block">
            {stock.healthy} SKUs healthy
          </span>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-amber-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.02)]">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
            Low Stock
          </span>
          <span className="text-2xl font-extrabold text-amber-600 mt-1 block">{stock.low}</span>
          <span className="text-[11px] font-semibold text-amber-700 mt-1 block">Requires reorder</span>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-rose-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.02)]">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
            Out of Stock
          </span>
          <span className="text-2xl font-extrabold text-rose-600 mt-1 block">
            {stock.outOfStock}
          </span>
          <span className="text-[11px] font-semibold text-rose-700 mt-1 block">Critical stockout</span>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-purple-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.02)]">
          <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider block">
            Expiring Soon
          </span>
          <span className="text-2xl font-extrabold text-purple-600 mt-1 block">
            {expiry.within30Days}
          </span>
          <span className="text-[11px] font-semibold text-purple-700 mt-1 block">Next 30 days</span>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.02)]">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Inventory Value
          </span>
          <span className="text-2xl font-extrabold text-[#0F172A] mt-1 block">
            LKR {(valuation.retail / 1000000).toFixed(1)}M
          </span>
          <span className="text-[11px] font-semibold text-slate-500 mt-1 block">Retail valuation</span>
        </div>
      </div>

      {/* SIMPLIFIED INVENTORY ALERTS & MOVEMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Simplified Alerts (7 cols) */}
        <div className="lg:col-span-7 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <TriangleAlert className="w-4 h-4 text-amber-500" />
              <span>Inventory Priority Alerts</span>
            </h2>
            <Link
              href="/admin/inventory/expiry"
              className="text-xs font-bold text-[#2563EB] hover:underline"
            >
              View Expiry Matrix &rarr;
            </Link>
          </div>

          <div className="space-y-2.5">
            {alerts.length > 0 ? (
              alerts.map((alt) => {
                const isCritical = alt.type === 'EXPIRED' || alt.type === 'OUT_OF_STOCK';
                return (
                  <div
                    key={alt.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                      isCritical
                        ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                        : 'bg-amber-50/70 border-amber-200 text-amber-950'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${
                          isCritical
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-600 text-white'
                        }`}
                      >
                        {alt.type?.replace('_', ' ')}
                      </span>
                      <div className="truncate">
                        <span className="font-bold text-[#0F172A] block leading-tight truncate">
                          {alt.title}
                        </span>
                        <span className="text-[11px] text-slate-600 block mt-0.5 truncate">
                          {alt.message}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={alt.href || '/admin/inventory/batches'}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors shadow-2xs ${
                        isCritical
                          ? 'bg-white hover:bg-rose-50 text-rose-700 border border-rose-300'
                          : 'bg-white hover:bg-amber-50 text-amber-700 border border-amber-300'
                      }`}
                    >
                      {alt.actionLabel || 'Review'}
                    </Link>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-slate-400 py-6 text-xs font-semibold">
                No critical inventory alerts at this time.
              </p>
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
            <Link
              href="/admin/inventory/movements"
              className="text-xs font-bold text-[#2563EB] hover:underline"
            >
              Full Ledger &rarr;
            </Link>
          </div>

          <div className="space-y-2">
            {movements.map((mov, i) => (
              <div
                key={mov.id || i}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-bold text-slate-800 block truncate">
                    {mov.product?.name || mov.product_name || 'Medicine'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(mov.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                    mov.quantity_change < 0
                      ? 'bg-rose-50 text-rose-600 border border-rose-100'
                      : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  }`}
                >
                  {mov.quantity_change < 0 ? mov.quantity_change : `+${mov.quantity_change}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
