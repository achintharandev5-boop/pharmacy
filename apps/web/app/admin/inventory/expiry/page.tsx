'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Clock3, CheckCircle2, ShieldAlert } from 'lucide-react';
import { getInventoryExpiryMatrix, adjustStock } from '@/app/actions/inventory';
import PageHeader from '@/components/admin/PageHeader';
import InventoryTabs from '@/components/admin/InventoryTabs';
import FilterTabs from '@/components/admin/FilterTabs';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import { ActionError, ErrorState, LoadingState, MISSING } from '@/components/admin/DataState';
import { useApiQuery } from '@/lib/useApiQuery';
import type { ApiData } from '@/lib/api/types';

export default function ExpiryManagementPage() {
  const [activeCategory, setActiveCategory] = useState<'expired' | 'expiring30' | 'expiring60' | 'expiring90'>('expired');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingBatchId, setPendingBatchId] = useState<string | null>(null);
  const matrixQuery = useApiQuery(() => getInventoryExpiryMatrix(), []);
  const matrix = matrixQuery.data ?? {};

  const handleQuarantineBatch = async (batch: ApiData) => {
    const qty = Number(batch.quantity_available ?? batch.current_quantity);
    if (!batch.product_id || !Number.isFinite(qty) || qty <= 0) {
      setActionError(`Batch ${batch.batch_number || ''} has no recorded remaining quantity to write off.`);
      return;
    }
    const confirmed = window.confirm(
      `Write off ${qty} unit(s) of expired batch ${batch.batch_number} (${batch.product?.name || batch.product_name || 'unknown product'})?\n\nThis reduces recorded stock and cannot be undone from this screen.`,
    );
    if (!confirmed) return;

    setActionMsg(null);
    setActionError(null);
    setPendingBatchId(batch.id);
    try {
      const res = await adjustStock({
        productId: batch.product_id,
        batchId: batch.id,
        type: 'EXPIRED',
        quantity: qty,
        reason: 'Quarantined due to batch expiration',
      });
      if (!res.ok) {
        setActionError(`Write-off failed: ${res.error}`);
        return;
      }
      setActionMsg(`Expired batch ${batch.batch_number}: ${qty} unit(s) written off.`);
      matrixQuery.retry();
    } catch {
      setActionError('Write-off failed: the pharmacy server could not be reached.');
    } finally {
      setPendingBatchId(null);
    }
  };

  const list = matrix[activeCategory] || [];

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      <PageHeader
        title="Batch Expiry"
        subtitle="Expired batches and batches expiring within 30, 60 and 90 days."
        icon={Clock3}
      />

      <InventoryTabs />

      {actionMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span>{actionMsg}</span>
          </div>
          <button type="button" onClick={() => setActionMsg(null)} className="text-emerald-800 hover:underline">
            Dismiss
          </button>
        </div>
      )}
      {actionError && <ActionError message={actionError} onDismiss={() => setActionError(null)} />}

      {/* FILTER TABS */}
      <div className="bg-white/88 backdrop-blur-md p-2 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          tabs={[
            { id: 'expired', label: 'Expired Batches', count: matrix.expired?.length },
            { id: 'expiring30', label: 'Within 30 Days', count: matrix.expiring30?.length },
            { id: 'expiring60', label: 'Within 60 Days', count: matrix.expiring60?.length },
            { id: 'expiring90', label: 'Within 90 Days', count: matrix.expiring90?.length },
          ]}
          activeTab={activeCategory}
          onChange={(tab: ApiData) => setActiveCategory(tab)}
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
              {matrixQuery.status === 'loading' ? (
                <tr>
                  <td colSpan={6}>
                    <LoadingState label="Loading batch expiry data…" />
                  </td>
                </tr>
              ) : matrixQuery.status === 'error' ? (
                <tr>
                  <td colSpan={6}>
                    <ErrorState title="Could not load batch expiry data" message={matrixQuery.error} onRetry={matrixQuery.retry} />
                  </td>
                </tr>
              ) : list.length > 0 ? (
                list.map((batch: ApiData) => (
                  <tr key={batch.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#2563EB]">
                      {batch.batch_number || MISSING}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {batch.product?.name || batch.product_name || MISSING}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-center text-slate-900">
                      {batch.quantity_available ?? batch.current_quantity ?? MISSING}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {batch.expiry_date || MISSING}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={activeCategory === 'expired' ? 'Expired' : 'Expiring'} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {activeCategory === 'expired' ? (
                        <button
                          type="button"
                          onClick={() => handleQuarantineBatch(batch)}
                          disabled={pendingBatchId !== null}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs transition-colors shadow-2xs inline-flex items-center gap-1.5"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>{pendingBatchId === batch.id ? 'Writing off…' : 'Write off'}</span>
                        </button>
                      ) : batch.product_id ? (
                        <Link
                          href={`/admin/products/${batch.product_id}`}
                          className="px-3 py-1.5 bg-white hover:bg-blue-50 text-[#2563EB] border border-blue-200 font-bold rounded-xl text-xs transition-colors shadow-2xs"
                        >
                          View product
                        </Link>
                      ) : null}
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
