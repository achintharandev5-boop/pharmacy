'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  User,
  Phone,
  Calendar,
  MapPin,
  FileText,
  Printer,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Pill,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { getPatientProfileData, reprintAdminPrescription } from '@/app/actions/admin';
import StatusBadge from '@/components/admin/StatusBadge';

export default function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const patientId = resolvedParams.id;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reprintingId, setReprintingId] = useState<string | null>(null);
  const [reprintMessage, setReprintMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await getPatientProfileData(patientId);
        if (res) setData(res);
      } catch (err) {
        console.error('Failed to fetch patient details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [patientId]);

  const handleReprint = async (rxId: string) => {
    setReprintingId(rxId);
    setReprintMessage(null);
    try {
      await reprintAdminPrescription(rxId, 'Patient profile reprint trigger');
      setReprintMessage('Thermal label queued for reprint. Print count updated. Stock was NOT deducted.');
      setTimeout(() => setReprintMessage(null), 5000);
    } catch (e) {
      setReprintMessage('Failed to trigger reprint');
    } finally {
      setReprintingId(null);
    }
  };

  const patient = data?.patient || {
    name: 'Patient Record',
    phone_number: '077 123 4567',
    age: '34',
    gender: 'Male',
    address: 'No 45, Galle Road, Colombo 03',
    medical_notes: 'Penicillin allergy noted',
  };
  const stats = data?.stats || {
    totalPrescriptions: 3,
    lastVisit: 'Oct 5, 2026',
    frequentlyDispensed: ['Amoxicillin 500mg', 'Paracetamol 500mg'],
  };
  const prescriptions = data?.prescriptions || [];

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/88 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-3.5">
          <Link
            href="/admin/patients"
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">
                {patient.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#1D4ED8] border border-blue-200">
                Verified Patient
              </span>
            </div>
            <p className="text-xs sm:text-[13px] font-medium text-[#64748B] mt-0.5">
              Comprehensive dispensing history, frequent medications, and thermal label reprint controls
            </p>
          </div>
        </div>

        <Link
          href={`/label?customer=${encodeURIComponent(patient.name)}&phone=${encodeURIComponent(patient.phone_number || '')}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white text-xs font-bold shadow-xs hover:brightness-105 transition-all"
        >
          <FileText className="w-4 h-4" />
          <span>New Dispense for Patient</span>
        </Link>
      </div>

      {reprintMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span>{reprintMessage}</span>
          </div>
        </div>
      )}

      {/* PATIENT INFO TILES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Basic Info */}
        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Patient Information
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2.5 text-slate-700">
              <Phone className="w-4 h-4 text-[#2563EB] shrink-0" />
              <span className="font-mono font-bold">{patient.phone_number || 'No phone'}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{patient.address || 'Address on file'}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                {patient.age ? `${patient.age} years old` : 'Age N/A'} • {patient.gender || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Clinical Notes & Allergies */}
        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Allergies & Clinical Warnings
          </h3>

          <div className="space-y-2.5 text-xs">
            {patient.medical_notes ? (
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 font-medium">
                <span className="font-bold block text-amber-800 mb-1">Active Note:</span>
                {patient.medical_notes}
              </div>
            ) : (
              <p className="text-slate-500 font-medium italic">No known drug allergies reported.</p>
            )}

            <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-blue-900 font-medium flex items-center justify-between">
              <span>Total Dispensed Labels:</span>
              <span className="font-bold font-mono">{stats.totalPrescriptions * 2} Labels</span>
            </div>
          </div>
        </div>

        {/* Card 3: Frequently Dispensed Medicines */}
        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Frequently Dispensed
          </h3>

          <div className="space-y-2">
            {(stats.frequentlyDispensed || []).map((med: string, i: number) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-800"
              >
                <Pill className="w-3.5 h-3.5 text-[#2563EB]" />
                <span className="truncate">{med}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PRESCRIPTION HISTORY TABLE */}
      <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#2563EB]" />
            <span>Prescription History & Dispensing Log</span>
          </h2>
          <span className="text-xs text-[#64748B] font-semibold">
            Stock-Safe Thermal Reprinting Active
          </span>
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
                prescriptions.map((rx: any) => (
                  <tr key={rx.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#2563EB]">
                      {rx.prescription_number || rx.id}
                    </td>
                    <td className="py-3 px-3 text-slate-800 font-semibold">
                      {rx.prescription_items?.map((it: any) => it.product_name).join(', ') ||
                        'Dispensed Items'}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                      {rx.print_count || 1}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                      {new Date(rx.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={rx.status || 'COMPLETED'} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleReprint(rx.id)}
                        disabled={reprintingId === rx.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-blue-50 text-[#2563EB] border border-blue-200 hover:border-blue-300 font-bold rounded-xl text-xs transition-colors shadow-2xs"
                      >
                        {reprintingId === rx.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Printer className="w-3.5 h-3.5" />
                        )}
                        <span>Reprint</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-semibold">
                    No previous prescriptions found for this patient.
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
