'use client';

import type { ApiData } from '@/lib/api/types';
import React, { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, TrendingDown, TrendingUp } from 'lucide-react';
import { getAdminProductById } from '@/app/actions/admin';
import StatusBadge from '@/components/admin/StatusBadge';
import { ErrorState, LoadingState, MISSING } from '@/components/admin/DataState';
import { useApiQuery } from '@/lib/useApiQuery';

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const productId = resolvedParams.id;

  const productQuery = useApiQuery(() => getAdminProductById(productId), [productId]);

  if (productQuery.status === 'loading') {
    return <LoadingState label="Loading product…" />;
  }

  if (productQuery.status === 'error') {
    return (
      <div className="space-y-4 select-none font-sans">
        <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900">
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
  const movements: ApiData[] = Array.isArray(data.movements) ? data.movements : [];
  const stock = typeof p.stock_quantity === 'number' ? p.stock_quantity : null;
  const reorderLevel = typeof p.reorder_level === 'number' ? p.reorder_level : null;
  const rawPrice = p.unit_price ?? p.retail_price;
  const price = rawPrice !== undefined && rawPrice !== null && Number.isFinite(Number(rawPrice)) ? Number(rawPrice) : null;

  let stockStatus: string | null = null;
  if (stock !== null) {
    if (stock <= 0) stockStatus = 'Out of Stock';
    else if (reorderLevel !== null && stock <= reorderLevel) stockStatus = 'Low Stock';
    else stockStatus = 'In Stock';
  }

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/88 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-3.5">
          <Link
            href="/admin/products"
            aria-label="Back to products"
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">{p.name || MISSING}</h1>
              {(p.brand_name || p.generic_name) && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#1D4ED8] border border-blue-200">
                  {p.brand_name || p.generic_name}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-[13px] font-medium text-[#64748B] mt-0.5">Stock level and movement history</p>
          </div>
        </div>
      </div>

      {/* METRIC TILES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-2">
          <span className="text-slate-400 font-bold uppercase text-[11px] tracking-wider">Current Inventory Level</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#0F172A]">
              {stock ?? MISSING} {stock !== null && <span className="text-sm font-semibold text-slate-500">units</span>}
            </span>
            {stockStatus && <StatusBadge status={stockStatus} />}
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-2">
          <span className="text-slate-400 font-bold uppercase text-[11px] tracking-wider">Unit Price & Valuation</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#0F172A]">{price !== null ? `LKR ${price.toFixed(2)}` : MISSING}</span>
            {price !== null && stock !== null && (
              <span className="text-xs font-mono font-bold text-slate-500">Total: LKR {(stock * price).toFixed(2)}</span>
            )}
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-2">
          <span className="text-slate-400 font-bold uppercase text-[11px] tracking-wider">Barcode & Expiry</span>
          <div className="flex flex-col text-xs font-semibold text-slate-700 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Barcode:</span>
              <span className="font-mono font-bold">{p.barcode || MISSING}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Expiry Date:</span>
              <span className="font-mono text-slate-900">{p.expiry_date || MISSING}</span>
            </div>
          </div>
        </div>
      </div>

      {/* MOVEMENTS */}
      <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] p-5 space-y-4">
        <h2 className="text-base font-bold text-[#0F172A] border-b border-slate-100 pb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#2563EB]" />
          <span>Stock Movements</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Quantity Change</th>
                <th className="py-3 px-3">Reason / Description</th>
                <th className="py-3 px-3">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {movements.length > 0 ? (
                movements.map((m: ApiData, idx: number) => {
                  const change = typeof m.quantity_change === 'number' ? m.quantity_change : typeof m.quantity === 'number' ? m.quantity : null;
                  const isDeduction = change !== null && change < 0;
                  return (
                    <tr key={m.id || idx} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 font-bold text-xs ${isDeduction ? 'text-rose-600' : 'text-[#10B981]'}`}>
                          {change !== null &&
                            (isDeduction ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />)}
                          <span>{m.movement_type || MISSING}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {change === null ? MISSING : `${isDeduction ? change : `+${change}`} units`}
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
                    No movements recorded yet for this product.
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
