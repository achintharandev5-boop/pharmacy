'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Search,
  Printer,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Eye,
  Plus,
} from 'lucide-react';
import { getAdminPrescriptions, reprintAdminPrescription } from '@/app/actions/admin';
import PageHeader from '@/components/admin/PageHeader';
import FilterTabs from '@/components/admin/FilterTabs';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';

export default function MasterPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [reprintingId, setReprintingId] = useState<string | null>(null);
  const [reprintMessage, setReprintMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadPrescriptions() {
      setLoading(true);
      try {
        const data = await getAdminPrescriptions(searchTerm, statusFilter);
        if (Array.isArray(data)) {
          setPrescriptions(data);
        }
      } catch (err) {
        console.error('Failed to load prescriptions:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPrescriptions();
  }, [searchTerm, statusFilter]);

  const handleReprint = async (rxId: string) => {
    setReprintingId(rxId);
    setReprintMessage(null);
    try {
      await reprintAdminPrescription(rxId, 'Reprint from Master Prescription directory');
      setReprintMessage('Thermal label queued for reprint. Print count updated (Inventory stock NOT deducted).');
      setTimeout(() => setReprintMessage(null), 5000);
    } catch (e) {
      setReprintMessage('Failed to trigger label reprint');
    } finally {
      setReprintingId(null);
    }
  };

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {/* HEADER */}
      <PageHeader
        title="Prescriptions"
        subtitle="Complete audit trail of all generated prescriptions, Sinhala label parameters, and print history"
        icon={FileText}
        actions={[
          {
            label: '+ New Prescription',
            href: '/label',
            variant: 'primary',
          },
        ]}
      />

      {reprintMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span>{reprintMessage}</span>
          </div>
        </div>
      )}

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
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-semibold">
                    <div className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading prescription records...</span>
                    </div>
                  </td>
                </tr>
              ) : prescriptions.length > 0 ? (
                prescriptions.map((rx) => {
                  const itemsSummary =
                    rx.prescription_items && rx.prescription_items.length > 0
                      ? rx.prescription_items.map((i: any) => i.product_name).join(', ')
                      : 'Prescription Medicine';

                  return (
                    <tr
                      key={rx.id}
                      className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-[#2563EB]">
                        {rx.prescription_number || 'RX-000000'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {rx.customer_name_text || 'Walk-in Patient'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {rx.customer_phone || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 max-w-[220px] truncate" title={itemsSummary}>
                        {itemsSummary}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">
                        {rx.print_count || 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={rx.status || 'COMPLETED'} />
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                        {new Date(rx.created_at).toLocaleString()}
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
                            onClick={() => handleReprint(rx.id)}
                            disabled={reprintingId === rx.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-blue-50 text-[#2563EB] border border-blue-200 hover:border-blue-300 rounded-lg text-xs font-bold transition-colors shadow-2xs"
                          >
                            {reprintingId === rx.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Printer className="w-3.5 h-3.5" />
                            )}
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
                      description={`No records found matching "${searchTerm}". Start dispensing from the Label Workstation.`}
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
