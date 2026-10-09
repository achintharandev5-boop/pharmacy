'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Boxes, Search, Plus, ArrowRight } from 'lucide-react';
import { getInventoryBatches } from '@/app/actions/inventory';
import PageHeader from '@/components/admin/PageHeader';
import InventoryTabs from '@/components/admin/InventoryTabs';
import FilterTabs from '@/components/admin/FilterTabs';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';

export default function BatchManagementPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBatches() {
      setLoading(true);
      try {
        const data = await getInventoryBatches(searchTerm, statusFilter);
        if (Array.isArray(data)) setBatches(data);
      } catch (err) {
        console.error('Failed to load batches:', err);
      } finally {
        setLoading(false);
      }
    }
    loadBatches();
  }, [searchTerm, statusFilter]);

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      <PageHeader
        title="FEFO Batch Management"
        subtitle="Track medicine batches, FEFO allocation queue, remaining quantities, and batch-level expiration dates."
        icon={Boxes}
        actions={[
          {
            label: 'Receive New Batch (GRN)',
            href: '/admin/inventory/receiving',
            variant: 'primary',
          },
        ]}
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
            placeholder="Search by batch number, medicine name, or barcode..."
            className="w-full h-[40px] pl-10 pr-4 bg-[#F8FBFF] border border-slate-200 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 rounded-xl text-xs font-semibold outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        <FilterTabs
          tabs={[
            { id: 'ALL', label: 'All Batches' },
            { id: 'ACTIVE', label: 'Active' },
            { id: 'EXPIRES_SOON', label: 'Expiring <30d' },
            { id: 'EXPIRED', label: 'Expired' },
            { id: 'DEPLETED', label: 'Depleted' },
            { id: 'QUARANTINED', label: 'Quarantined' },
          ]}
          activeTab={statusFilter}
          onChange={(st) => setStatusFilter(st)}
        />
      </div>

      {/* BATCHES TABLE */}
      <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Batch Number</th>
                <th className="py-3.5 px-4">Medicine / Product</th>
                <th className="py-3.5 px-4 text-center">Remaining Stock</th>
                <th className="py-3.5 px-4 text-center">Initial Qty</th>
                <th className="py-3.5 px-4">Expiry Date</th>
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
                      <span>Loading FEFO batches...</span>
                    </div>
                  </td>
                </tr>
              ) : batches.length > 0 ? (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-blue-50/40 transition-colors group">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#2563EB]">
                      {b.batch_number}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {b.product?.name || b.product_name || 'Medicine'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-center text-slate-900">
                      {b.current_quantity ?? b.quantity ?? 0}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-center text-slate-500">
                      {b.initial_quantity ?? b.quantity ?? 0}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {b.expiry_date}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={b.status || 'ACTIVE'} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/admin/products/${b.product_id || 'prod_1'}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-blue-50 text-[#2563EB] border border-blue-200 hover:border-blue-300 font-bold rounded-xl text-xs transition-colors shadow-2xs"
                      >
                        <span>Details</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#2563EB]" />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="No batches found"
                      description={`No batches matched your filter "${statusFilter}".`}
                      actionText="Receive Stock (GRN)"
                      actionHref="/admin/inventory/receiving"
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
