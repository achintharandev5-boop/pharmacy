'use client';

import React, { useState } from 'react';
import { History, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { getInventoryMovements } from '@/app/actions/inventory';
import PageHeader from '@/components/admin/PageHeader';
import InventoryTabs from '@/components/admin/InventoryTabs';
import FilterTabs from '@/components/admin/FilterTabs';
import EmptyState from '@/components/admin/EmptyState';
import { ErrorState, LoadingState, MISSING } from '@/components/admin/DataState';
import { useApiQuery } from '@/lib/useApiQuery';

export default function StockMovementsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const movementsQuery = useApiQuery(() => getInventoryMovements(searchTerm, typeFilter), [searchTerm, typeFilter]);
  const movements = movementsQuery.data ?? [];

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      <PageHeader
        title="Stock Movement Audit Ledger"
        subtitle="Transaction history of stock receipts, dispenses, adjustments, and returns."
        icon={History}
      />

      <InventoryTabs />

      {/* SEARCH & FILTERS BAR */}
      <div className="bg-white/88 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search product, batch number, or prescription RX..."
            className="w-full h-[40px] pl-10 pr-4 bg-[#F8FBFF] border border-slate-200 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 rounded-xl text-xs font-semibold outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        <FilterTabs
          tabs={[
            { id: 'ALL', label: 'All Movements' },
            { id: 'DISPENSED', label: 'Dispensed' },
            { id: 'STOCK_RECEIVED', label: 'Received (GRN)' },
            { id: 'ADJUSTMENT', label: 'Adjustments' },
            { id: 'EXPIRED', label: 'Quarantined' },
          ]}
          activeTab={typeFilter}
          onChange={(tab) => setTypeFilter(tab)}
        />
      </div>

      {/* MOVEMENTS TABLE */}
      <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Medicine / SKU</th>
                <th className="py-3.5 px-4">Batch Number</th>
                <th className="py-3.5 px-4 text-center">Change</th>
                <th className="py-3.5 px-4">Description / Reference</th>
                <th className="py-3.5 px-4">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {movementsQuery.status === 'loading' ? (
                <tr>
                  <td colSpan={6}>
                    <LoadingState label="Loading stock movements…" />
                  </td>
                </tr>
              ) : movementsQuery.status === 'error' ? (
                <tr>
                  <td colSpan={6}>
                    <ErrorState title="Could not load stock movements" message={movementsQuery.error} onRetry={movementsQuery.retry} />
                  </td>
                </tr>
              ) : movements.length > 0 ? (
                movements.map((m) => {
                  const isDeduction = m.quantity_change < 0;
                  return (
                    <tr key={m.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3.5 px-4">
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
                          <span>{m.movement_type}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {m.product?.name || m.product_name || MISSING}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-600">
                        {m.batch?.batch_number || m.batch_number || MISSING}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            isDeduction
                              ? 'bg-rose-50 text-rose-600 border border-rose-100'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}
                        >
                          {isDeduction ? m.quantity_change : `+${m.quantity_change}`}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-[250px] truncate" title={m.notes}>
                        {m.notes || MISSING}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                        {m.created_at ? new Date(m.created_at).toLocaleString() : MISSING}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="No movements recorded"
                      description={
                        searchTerm || typeFilter !== 'ALL'
                          ? 'No stock movements match the current search or filter.'
                          : 'No stock movements have been recorded yet.'
                      }
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
