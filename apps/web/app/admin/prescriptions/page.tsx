'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FileText, Search, Printer, Eye } from 'lucide-react';
import { getAdminPrescriptions } from '@/app/actions/admin';
import PageHeader from '@/components/admin/PageHeader';
import FilterTabs from '@/components/admin/FilterTabs';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import { ErrorState, LoadingState, MISSING } from '@/components/admin/DataState';
import { useApiQuery } from '@/lib/useApiQuery';
import { REPRINT_UNAVAILABLE_REASON } from '@/lib/reprint';
import type { ApiData } from '@/lib/api/types';

export default function MasterPrescriptionsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const prescriptionsQuery = useApiQuery(() => getAdminPrescriptions(searchTerm, statusFilter), [searchTerm, statusFilter]);
  const prescriptions = prescriptionsQuery.data ?? [];

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {/* HEADER */}
      <PageHeader
        title="Prescriptions"
        subtitle="Prescriptions recorded from the label workstation, with label and print details."
        icon={FileText}
        actions={[
          {
            label: '+ New Prescription',
            href: '/label',
            variant: 'primary',
          },
        ]}
      />

      {/* SEARCH & FILTERS BAR */}
      <div className="bg-white/88 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by RX Number, Patient Name, Mobile or Product..."
            className="w-full h-[40px] pl-10 pr-4 bg-[#F8FBFF] border border-slate-200 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 rounded-xl text-xs font-semibold outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        <FilterTabs
          tabs={['ALL', 'COMPLETED', 'DRAFT', 'CANCELLED']}
          activeTab={statusFilter}
          onChange={(tab) => setStatusFilter(tab)}
        />
      </div>

      {/* PRESCRIPTIONS TABLE */}
      <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">RX Number</th>
                <th className="py-3.5 px-4">Patient</th>
                <th className="py-3.5 px-4">Mobile</th>
                <th className="py-3.5 px-4">Medicines</th>
                <th className="py-3.5 px-4 text-center">Labels</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {prescriptionsQuery.status === 'loading' ? (
                <tr>
                  <td colSpan={8}>
                    <LoadingState label="Loading prescriptions…" />
                  </td>
                </tr>
              ) : prescriptionsQuery.status === 'error' ? (
                <tr>
                  <td colSpan={8}>
                    <ErrorState title="Could not load prescriptions" message={prescriptionsQuery.error} onRetry={prescriptionsQuery.retry} />
                  </td>
                </tr>
              ) : prescriptions.length > 0 ? (
                prescriptions.map((rx) => {
                  const itemsSummary =
                    rx.prescription_items && rx.prescription_items.length > 0
                      ? rx.prescription_items.map((i: ApiData) => i.product_name || MISSING).join(', ')
                      : MISSING;

                  return (
                    <tr key={rx.id} className="hover:bg-blue-50/40 transition-colors group">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#2563EB]">
                        {rx.prescription_number || MISSING}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {rx.customer_name_text || MISSING}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {rx.customer_phone || MISSING}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 max-w-[220px] truncate" title={itemsSummary}>
                        {itemsSummary}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">
                        {rx.print_count ?? MISSING}
                      </td>
                      <td className="py-3.5 px-4">
                        {rx.status ? <StatusBadge status={rx.status} /> : MISSING}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                        {rx.created_at ? new Date(rx.created_at).toLocaleString() : MISSING}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={`/admin/prescriptions/${rx.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                            <span>View</span>
                          </Link>

                          <button
                            type="button"
                            disabled
                            title={REPRINT_UNAVAILABLE_REASON}
                            aria-label={`Reprint (${REPRINT_UNAVAILABLE_REASON})`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-400 border border-slate-200 rounded-lg text-xs font-bold cursor-not-allowed"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Reprint</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      title="No prescriptions found"
                      description={
                        searchTerm || statusFilter !== 'ALL'
                          ? 'No prescriptions match the current search or filter.'
                          : 'No prescriptions have been recorded yet. Prescriptions saved from the Label Workstation appear here.'
                      }
                      actionText="Open Label Workstation"
                      actionHref="/label"
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
