'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  FileText,
  User,
  Phone,
  Printer,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Pill,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { getAdminPrescriptionById, reprintAdminPrescription } from '@/app/actions/admin';
import StatusBadge from '@/components/admin/StatusBadge';

export default function PrescriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const rxId = resolvedParams.id;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reprinting, setReprinting] = useState(false);
  const [reprintMessage, setReprintMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await getAdminPrescriptionById(rxId);
        if (res) setData(res);
      } catch (err) {
        console.error('Failed to fetch prescription details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [rxId]);

  const handleReprint = async () => {
    setReprinting(true);
    setReprintMessage(null);
    try {
      await reprintAdminPrescription(rxId, 'Reprint from Prescription detail page');
      setReprintMessage('Thermal label queued for reprint. Print count incremented. Stock was NOT deducted.');
      const updated = await getAdminPrescriptionById(rxId);
      if (updated) setData(updated);
      setTimeout(() => setReprintMessage(null), 6000);
    } catch (e) {
      setReprintMessage('Failed to trigger label reprint');
    } finally {
      setReprinting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-semibold select-none">
        <div className="inline-flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading Prescription Details...</span>
        </div>
      </div>
    );
  }

  const rx = data?.prescription || {};
  const events = data?.events || [];
  const items = rx.prescription_items || [];

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/88 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-3.5">
          <Link
            href="/admin/prescriptions"
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-[#2563EB]">
                {rx.prescription_number || 'RX-000000'}
              </h1>
              <StatusBadge status={rx.status || 'COMPLETED'} />
            </div>
            <p className="text-xs sm:text-[13px] font-medium text-[#64748B] mt-0.5">
              Prescription audit detail, Sinhala label parameters, and chronological event trail
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReprint}
          disabled={reprinting}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white text-xs font-bold shadow-xs hover:brightness-105 transition-all"
        >
          {reprinting ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Printer className="w-4 h-4" />
          )}
          <span>Reprint Thermal Label</span>
        </button>
      </div>

      {reprintMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span>{reprintMessage}</span>
          </div>
        </div>
      )}

      {/* METADATA GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Patient Information
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[#2563EB]" />
              <span className="font-bold text-slate-900">{rx.customer_name_text || 'Walk-in'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-400" />
              <span className="font-mono text-slate-600">{rx.customer_phone || 'No phone'}</span>
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
              <span className="font-mono">{new Date(rx.created_at).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Lifetime Prints:</span>
              <span className="font-bold text-[#2563EB]">{rx.print_count || 1} Times</span>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Safety & Audit Policy
          </h3>
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/70 rounded-xl text-[11px] text-emerald-950 font-medium space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900">
              <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Stock Isolation</span>
            </div>
            <p>
              Reprinting this prescription dispatches thermal labels without deducting inventory units.
            </p>
          </div>
        </div>
      </div>

      {/* DISPENSED ITEMS TABLE */}
      <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] p-5 space-y-4">
        <h2 className="text-base font-bold text-[#0F172A] border-b border-slate-100 pb-3 flex items-center gap-2">
          <Pill className="w-4 h-4 text-[#2563EB]" />
          <span>Prescribed Medicines & Label Payloads</span>
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
              {items.map((it: any, idx: number) => (
                <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-900">{it.product_name}</td>
                  <td className="py-3 px-3 text-slate-700 font-semibold">{it.dosage_summary || 'Standard Dosage'}</td>
                  <td className="py-3 px-3 text-slate-800 sinhala-text">{it.sinhala_instruction || 'දිනකට නියමිත පරිදි'}</td>
                  <td className="py-3 px-3 font-mono font-bold text-center text-slate-800">{it.quantity || 1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
