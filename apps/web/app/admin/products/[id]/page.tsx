'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  Package,
  ArrowLeft,
  Calendar,
  DollarSign,
  Barcode,
  Clock,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { getAdminProductById } from '@/app/actions/admin';
import StatusBadge from '@/components/admin/StatusBadge';

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const productId = resolvedParams.id;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await getAdminProductById(productId);
        if (res) setData(res);
      } catch (err) {
        console.error('Failed to fetch product details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [productId]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-semibold select-none">
        <div className="inline-flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading Product & Inventory Movements...</span>
        </div>
      </div>
    );
  }

  const p = data?.product || {};
  const movements = data?.movements || [];
  const stock = Number(p.stock_quantity || 0);

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/88 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-3.5">
          <Link
            href="/admin/products"
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">
                {p.name || 'Product Detail'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#1D4ED8] border border-blue-200">
                {p.brand_name || 'Generic'}
              </span>
            </div>
            <p className="text-xs sm:text-[13px] font-medium text-[#64748B] mt-0.5">
              Stock movement ledger, dispensing log, and inventory audit trail
            </p>
          </div>
        </div>
      </div>

      {/* METRIC TILES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-2">
          <span className="text-slate-400 font-bold uppercase text-[11px] tracking-wider">
            Current Inventory Level
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#0F172A]">
              {stock}{' '}
              <span className="text-sm font-semibold text-slate-500">units</span>
            </span>
            <StatusBadge
              status={stock <= 0 ? 'Out of Stock' : stock <= 15 ? 'Low Stock' : 'In Stock'}
            />
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-2">
          <span className="text-slate-400 font-bold uppercase text-[11px] tracking-wider">
            Unit Price & Valuation
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#0F172A]">
              LKR {Number(p.unit_price || 0).toFixed(2)}
            </span>
            <span className="text-xs font-mono font-bold text-slate-500">
              Total: LKR {(stock * Number(p.unit_price || 0)).toFixed(2)}
            </span>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-2">
          <span className="text-slate-400 font-bold uppercase text-[11px] tracking-wider">
            Barcode & Expiry
          </span>
          <div className="flex flex-col text-xs font-semibold text-slate-700 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Barcode:</span>
              <span className="font-mono font-bold">{p.barcode || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Expiry Date:</span>
              <span className="font-mono text-slate-900">{p.expiry_date || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* MOVEMENTS AUDIT TRAIL */}
      <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] p-5 space-y-4">
        <h2 className="text-base font-bold text-[#0F172A] border-b border-slate-100 pb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#2563EB]" />
          <span>Real-time Stock Movements Ledger</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Quantity Delta</th>
                <th className="py-3 px-3">Reason / Description</th>
                <th className="py-3 px-3">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {movements.length > 0 ? (
                movements.map((m: any, idx: number) => {
                  const isDeduction = m.quantity_change < 0;
                  return (
                    <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 font-bold text-xs ${
                            isDeduction ? 'text-rose-600' : 'text-[#10B981]'
                          }`}
                        >
                          {isDeduction ? (
                            <TrendingDown className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingUp className="w-3.5 h-3.5" />
                          )}
                          <span>{m.movement_type || (isDeduction ? 'DISPENSED' : 'RECEIVED')}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {isDeduction ? m.quantity_change : `+${m.quantity_change}`} units
                      </td>
                      <td className="py-3 px-3 text-slate-600">{m.notes || 'Normal pharmacy operation'}</td>
                      <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                        {new Date(m.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400 font-semibold">
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
