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
  Boxes,
  Truck,
  History,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { getAdminProductById } from '@/app/actions/admin';
import PageHeader from '@/components/admin/PageHeader';
import InventoryTabs from '@/components/admin/InventoryTabs';
import FilterTabs from '@/components/admin/FilterTabs';
import StatusBadge from '@/components/admin/StatusBadge';

export default function Product360Page({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const productId = resolvedParams.id;

  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'batches' | 'movements' | 'suppliers'>(
    'overview'
  );
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
          <span>Loading Product Profile...</span>
        </div>
      </div>
    );
  }

  const p = data?.product || {
    name: 'Amoxicillin 500mg',
    generic_name: 'Amoxicillin Trihydrate',
    strength: '500mg',
    dosage_form: 'Capsule',
    barcode: '8934002',
    sku: 'SKU-AMOX-500',
    stock_quantity: 420,
    unit_price: 25.0,
    purchase_cost: 18.5,
    reorder_level: 50,
    category: 'Antibiotics',
  };

  const batches = data?.batches || [];
  const movements = data?.movements || [];
  const stock = Number(p.stock_quantity || 0);

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      <PageHeader
        title={p.name}
        subtitle={`${p.generic_name || 'Generic'} • ${p.category || 'General'} • Barcode: ${p.barcode || 'N/A'}`}
        icon={Package}
        badge={p.category}
        actions={[
          {
            label: 'Receive Stock (GRN)',
            href: `/admin/inventory/receiving?product=${encodeURIComponent(p.name)}`,
            variant: 'primary',
          },
        ]}
      />

      <InventoryTabs />

      {/* METRIC TILES */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.02)] space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Total Inventory
          </span>
          <span className="text-2xl font-extrabold text-[#0F172A] block">{stock} units</span>
          <StatusBadge status={stock <= 0 ? 'Out of Stock' : stock <= 15 ? 'Low Stock' : 'In Stock'} />
        </div>

        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.02)] space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Retail Price
          </span>
          <span className="text-2xl font-extrabold text-[#2563EB] block">
            LKR {Number(p.unit_price || 0).toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-500 font-semibold block">Counter sales price</span>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.02)] space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Purchase Cost
          </span>
          <span className="text-2xl font-extrabold text-slate-800 block">
            LKR {Number(p.purchase_cost || 0).toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-500 font-semibold block">Average acquisition cost</span>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.02)] space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Reorder Level
          </span>
          <span className="text-2xl font-extrabold text-amber-600 block">
            {p.reorder_level || 15} units
          </span>
          <span className="text-[11px] text-slate-500 font-semibold block">Threshold trigger</span>
        </div>
      </div>

      {/* SUB-TABS */}
      <div className="bg-white/88 backdrop-blur-md p-2 rounded-2xl border border-slate-200/70 shadow-[0_2px_10px_rgba(15,23,42,0.02)]">
        <FilterTabs
          tabs={[
            { id: 'overview', label: 'Batch Details' },
            { id: 'movements', label: 'Movement Ledger' },
          ]}
          activeTab={activeTab}
          onChange={(tab: any) => setActiveTab(tab)}
        />
      </div>

      {activeTab === 'overview' && (
        <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] p-5 space-y-4">
          <h2 className="text-base font-bold text-[#0F172A] border-b border-slate-100 pb-3 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-[#2563EB]" />
            <span>Active FEFO Batches</span>
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
                  batches.map((b: any, i: number) => (
                    <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-[#2563EB]">
                        {b.batch_number}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-center text-slate-900">
                        {b.current_quantity ?? b.quantity ?? 0}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700">{b.expiry_date}</td>
                      <td className="py-3 px-3">
                        <StatusBadge status={b.status || 'Active'} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400 font-semibold">
                      No active batches for this SKU.
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
            <span>Product Audit Ledger</span>
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
                  movements.map((m: any, i: number) => {
                    const isDec = m.quantity_change < 0;
                    return (
                      <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-800">
                          {m.movement_type || (isDec ? 'DISPENSE' : 'RECEIPT')}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              isDec
                                ? 'bg-rose-50 text-rose-600'
                                : 'bg-emerald-50 text-emerald-600'
                            }`}
                          >
                            {isDec ? m.quantity_change : `+${m.quantity_change}`}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{m.notes || 'Normal operation'}</td>
                        <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                          {new Date(m.created_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400 font-semibold">
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
