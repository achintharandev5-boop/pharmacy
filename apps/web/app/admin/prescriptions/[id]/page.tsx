'use client';

import type { ApiData } from '@/lib/api/types';
import React, { use } from 'react';
import Link from 'next/link';
import { User, Phone, Printer, ArrowLeft, Pill } from 'lucide-react';
import { getAdminPrescriptionById } from '@/app/actions/admin';
import StatusBadge from '@/components/admin/StatusBadge';
import { ErrorState, LoadingState, MISSING } from '@/components/admin/DataState';
import { useApiQuery } from '@/lib/useApiQuery';
import { REPRINT_UNAVAILABLE_REASON } from '@/lib/reprint';

export default function PrescriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const rxId = resolvedParams.id;

  const rxQuery = useApiQuery(() => getAdminPrescriptionById(rxId), [rxId]);

  if (rxQuery.status === 'loading') {
    return <LoadingState label="Loading prescription…" />;
  }

  if (rxQuery.status === 'error') {
    return (
      <div className="space-y-4 select-none font-sans">
        <Link href="/admin/prescriptions" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" />
          Back to prescriptions
        </Link>
        <div className="bg-white rounded-2xl border border-slate-200">
          <ErrorState title="Could not load prescription" message={rxQuery.error} onRetry={rxQuery.retry} />
        </div>
      </div>
    );
  }

  const rx = rxQuery.data.prescription ?? rxQuery.data;
  const items: ApiData[] = Array.isArray(rx.prescription_items) ? rx.prescription_items : [];

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/88 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-3.5">
          <Link
            href="/admin/prescriptions"
            aria-label="Back to prescriptions"
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-[#2563EB]">
                {rx.prescription_number || MISSING}
              </h1>
              {rx.status && <StatusBadge status={rx.status} />}
            </div>
            <p className="text-xs sm:text-[13px] font-medium text-[#64748B] mt-0.5">
              Prescription details and label instructions as recorded
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled
          title={REPRINT_UNAVAILABLE_REASON}
          aria-label={`Reprint label (${REPRINT_UNAVAILABLE_REASON})`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-400 border border-slate-200 text-xs font-bold cursor-not-allowed"
        >
          <Printer className="w-4 h-4" />
          <span>Reprint Label</span>
        </button>
      </div>

      {/* METADATA GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Patient Information
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[#2563EB]" aria-label="Patient name" />
              <span className="font-bold text-slate-900">{rx.customer_name_text || MISSING}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-400" aria-label="Phone" />
              <span className="font-mono text-slate-600">{rx.customer_phone || MISSING}</span>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Dispensing Summary
          </h3>
          <div className="space-y-2 text-xs font-semibold text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Created:</span>
              <span className="font-mono">{rx.created_at ? new Date(rx.created_at).toLocaleString() : MISSING}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Times printed:</span>
              <span className="font-bold text-[#2563EB]">{rx.print_count ?? MISSING}</span>
            </div>
          </div>
        </div>
      </div>

      {/* DISPENSED ITEMS TABLE */}
      <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] p-5 space-y-4">
        <h2 className="text-base font-bold text-[#0F172A] border-b border-slate-100 pb-3 flex items-center gap-2">
          <Pill className="w-4 h-4 text-[#2563EB]" />
          <span>Prescribed Medicines</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">Medicine</th>
                <th className="py-3 px-3">Dosage / Timings</th>
                <th className="py-3 px-3">Sinhala Instructions</th>
                <th className="py-3 px-3 text-center">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {items.length > 0 ? (
                items.map((it: ApiData, idx: number) => (
                  <tr key={it.id || idx} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900">{it.product_name || MISSING}</td>
                    <td className="py-3 px-3 text-slate-700 font-semibold">{it.dosage_summary || MISSING}</td>
                    {/* Clinical text is shown exactly as recorded; nothing is substituted when it is missing. */}
                    <td className="py-3 px-3 text-slate-800 sinhala-text">{it.sinhala_instruction || MISSING}</td>
                    <td className="py-3 px-3 font-mono font-bold text-center text-slate-800">{it.quantity ?? MISSING}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500 font-semibold">
                    No medicines are recorded on this prescription.
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
