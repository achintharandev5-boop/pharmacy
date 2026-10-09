'use client';

import type { ApiData } from '@/lib/api/types';
import React, { use } from 'react';
import Link from 'next/link';
import { User, Phone, MapPin, FileText, Printer, Clock, ArrowLeft, Pill } from 'lucide-react';
import { getPatientProfileData } from '@/app/actions/admin';
import StatusBadge from '@/components/admin/StatusBadge';
import { ErrorState, LoadingState, MISSING } from '@/components/admin/DataState';
import { useApiQuery } from '@/lib/useApiQuery';
import { REPRINT_UNAVAILABLE_REASON } from '@/lib/reprint';

export default function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const patientId = resolvedParams.id;

  const profileQuery = useApiQuery(() => getPatientProfileData(patientId), [patientId]);

  if (profileQuery.status === 'loading') {
    return <LoadingState label="Loading patient…" />;
  }

  if (profileQuery.status === 'error') {
    return (
      <div className="space-y-4 select-none font-sans">
        <Link href="/admin/patients" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" />
          Back to patients
        </Link>
        <div className="bg-white rounded-2xl border border-slate-200">
          <ErrorState title="Could not load patient" message={profileQuery.error} onRetry={profileQuery.retry} />
        </div>
      </div>
    );
  }

  const data = profileQuery.data;
  const patient = data.patient ?? {};
  const stats = data.stats ?? {};
  const prescriptions: ApiData[] = Array.isArray(data.prescriptions) ? data.prescriptions : [];
  const frequentlyDispensed: string[] = Array.isArray(stats.frequentlyDispensed) ? stats.frequentlyDispensed : [];

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/88 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-3.5">
          <Link
            href="/admin/patients"
            aria-label="Back to patients"
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">{patient.name || MISSING}</h1>
            <p className="text-xs sm:text-[13px] font-medium text-[#64748B] mt-0.5">Patient details and prescription history</p>
          </div>
        </div>

        <Link
          href="/label"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white text-xs font-bold shadow-xs hover:brightness-105 transition-all"
        >
          <FileText className="w-4 h-4" />
          <span>Open Label Workstation</span>
        </Link>
      </div>

      {/* PATIENT INFO TILES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Basic Info */}
        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Patient Information
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2.5 text-slate-700">
              <Phone className="w-4 h-4 text-[#2563EB] shrink-0" aria-label="Phone" />
              <span className="font-mono font-bold">{patient.phone_number || MISSING}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" aria-label="Address" />
              <span>{patient.address || MISSING}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700">
              <User className="w-4 h-4 text-slate-400 shrink-0" aria-label="Age and gender" />
              <span>
                {patient.age ? `${patient.age} years old` : MISSING} • {patient.gender || MISSING}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Medical notes */}
        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Medical Notes
          </h3>

          <div className="space-y-2.5 text-xs">
            {patient.medical_notes ? (
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 font-medium">
                <span className="font-bold block text-amber-800 mb-1">Recorded note:</span>
                {patient.medical_notes}
              </div>
            ) : (
              // An empty notes field does not mean the patient has no allergies.
              <p className="text-slate-600 font-medium">
                No medical notes recorded. Allergy status is unknown; confirm with the patient.
              </p>
            )}

            <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-blue-900 font-medium flex items-center justify-between">
              <span>Total prescriptions:</span>
              <span className="font-bold font-mono">{stats.totalPrescriptions ?? MISSING}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Frequently Dispensed Medicines */}
        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Frequently Dispensed
          </h3>

          <div className="space-y-2">
            {frequentlyDispensed.length > 0 ? (
              frequentlyDispensed.map((med: string, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-800"
                >
                  <Pill className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span className="truncate">{med}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 font-medium">No dispensing history recorded.</p>
            )}
          </div>
        </div>
      </div>

      {/* PRESCRIPTION HISTORY TABLE */}
      <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#2563EB]" />
            <span>Prescription History</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">RX Number</th>
                <th className="py-3 px-3">Dispensed Medicines</th>
                <th className="py-3 px-3 text-center">Print Count</th>
                <th className="py-3 px-3">Date & Time</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Reprint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {prescriptions.length > 0 ? (
                prescriptions.map((rx: ApiData, i: number) => {
                  const medicines = Array.isArray(rx.prescription_items)
                    ? rx.prescription_items.map((it: ApiData) => it.product_name).filter(Boolean).join(', ')
                    : '';
                  return (
                    <tr key={rx.id || i} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-[#2563EB]">
                        {rx.id ? (
                          <Link href={`/admin/prescriptions/${rx.id}`} className="hover:underline">
                            {rx.prescription_number || rx.id}
                          </Link>
                        ) : (
                          rx.prescription_number || MISSING
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-800 font-semibold">{medicines || MISSING}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">{rx.print_count ?? MISSING}</td>
                      <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                        {rx.created_at ? new Date(rx.created_at).toLocaleString() : MISSING}
                      </td>
                      <td className="py-3 px-3">{rx.status ? <StatusBadge status={rx.status} /> : MISSING}</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          disabled
                          title={REPRINT_UNAVAILABLE_REASON}
                          aria-label={`Reprint (${REPRINT_UNAVAILABLE_REASON})`}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-400 border border-slate-200 font-bold rounded-xl text-xs cursor-not-allowed"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Reprint</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-semibold">
                    No prescriptions recorded for this patient.
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
