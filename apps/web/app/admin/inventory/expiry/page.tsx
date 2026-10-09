'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock3, AlertOctagon, TriangleAlert, Calendar, CheckCircle2, ShieldAlert } from 'lucide-react';
import { getInventoryExpiryMatrix, adjustStock } from '@/app/actions/inventory';
import PageHeader from '@/components/admin/PageHeader';
import InventoryTabs from '@/components/admin/InventoryTabs';
import FilterTabs from '@/components/admin/FilterTabs';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';

export default function ExpiryManagementPage() {
  const [matrix, setMatrix] = useState<any>({ expired: [], expiring30: [], expiring60: [], expiring90: [] });
  const [activeCategory, setActiveCategory] = useState<'expired' | 'expiring30' | 'expiring60' | 'expiring90'>('expired');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadMatrix() {
      setLoading(true);
      try {
        const res = await getInventoryExpiryMatrix();
        if (res) setMatrix(res);
      } catch (err) {
        console.error('Failed to load expiry matrix:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMatrix();
  }, []);

  const handleQuarantineBatch = async (batch: any) => {
    setActionMsg(null);
    try {
      await adjustStock({
        productId: batch.product_id,
        batchId: batch.id,
        type: 'EXPIRED',
        quantity: Math.abs(batch.quantity_available),
        reason: 'Quarantined due to batch expiration',
      });
      setActionMsg(`Batch ${batch.batch_number} quarantined and removed from FEFO dispensing queue.`);
      const res = await getInventoryExpiryMatrix();
      if (res) setMatrix(res);
      setTimeout(() => setActionMsg(null), 5000);
    } catch (e) {
      setActionMsg('Failed to quarantine batch');
    }
  };

  const list = matrix[activeCategory] || [];

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      <PageHeader
        title="Batch Expiry Management Matrix"
        subtitle="Enforce FEFO protection, quarantine expired medicine batches, and track 30/60/90 day expiry risk."
        icon={Clock3}
      />

      <InventoryTabs />

      {actionMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span>{actionMsg}</span>
          </div>
        </div>
      )}

      {/* FILTER TABS */}
      <div className="bg-white/88 backdrop-blur-md p-2 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          tabs={[
            { id: 'expired', label: 'Expired Batches', count: matrix.expired?.length || 0 },
            { id: 'expiring30', label: 'Within 30 Days', count: matrix.expiring30?.length || 0 },
            { id: 'expiring60', label: 'Within 60 Days', count: matrix.expiring60?.length || 0 },
            { id: 'expiring90', label: 'Within 90 Days', count: matrix.expiring90?.length || 0 },
          ]}
          activeTab={activeCategory}
          onChange={(tab: any) => setActiveCategory(tab)}
        />
      </div>

      {/* TABLE */}
      <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Batch Number</th>
                <th className="py-3.5 px-4">Medicine Name</th>
                <th className="py-3.5 px-4 text-center">Units Remaining</th>
                <th className="py-3.5 px-4">Expiry Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">
                    <div className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading expiry matrix...</span>
                    </div>
                  </td>
                </tr>
              ) : list.length > 0 ? (
                list.map((batch: any) => (
                  <tr key={batch.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#2563EB]">
                      {batch.batch_number}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {batch.product?.name || batch.product_name || 'Medicine'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-center text-slate-900">
                      {batch.quantity_available || batch.current_quantity || 0}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {batch.expiry_date}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={activeCategory === 'expired' ? 'Expired' : 'Expiring'} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {activeCategory === 'expired' ? (
                        <button
                          type="button"
                          onClick={() => handleQuarantineBatch(batch)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs transition-colors shadow-2xs inline-flex items-center gap-1.5"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>Quarantine</span>
                        </button>
                      ) : (
                        <Link
                          href={`/admin/products/${batch.product_id || 'prod_1'}`}
                          className="px-3 py-1.5 bg-white hover:bg-blue-50 text-[#2563EB] border border-blue-200 font-bold rounded-xl text-xs transition-colors shadow-2xs"
                        >
                          View SKU
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="No batches in this expiry window"
                      description="No batches currently match the selected threshold."
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
