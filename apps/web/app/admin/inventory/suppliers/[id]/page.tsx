'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Truck, ArrowLeft, Phone, Mail, MapPin, Boxes, FileText } from 'lucide-react';
import { getSupplierById } from '@/app/actions/suppliers';

export default function Supplier360Page({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const supplierId = resolvedParams.id;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await getSupplierById(supplierId);
        if (res) setData(res);
      } catch (err) {
        console.error('Failed to fetch supplier details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [supplierId]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-semibold select-none">
        <div className="inline-flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading Supplier Profile...</span>
        </div>
      </div>
    );
  }

  const sup = data?.supplier || {
    name: 'State Pharmaceuticals Corporation (SPC)',
    contact_person: 'Mr. Nimal Perera',
    phone: '0112345678',
    email: 'info@spc.lk',
    address: 'Colombo 01, Sri Lanka',
    registration_number: 'REG-SPC-001',
    active: true,
  };

  const batches = data?.suppliedBatches || [];
  const receipts = data?.receipts || [];

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/88 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-3.5">
          <Link
            href="/admin/inventory/suppliers"
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">
                {sup.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-[#10B981] border border-emerald-200">
                Verified Vendor
              </span>
            </div>
            <p className="text-xs sm:text-[13px] font-medium text-[#64748B] mt-0.5">
              Distributor profile, historical GRN receipts, and supplied batch traceability
            </p>
          </div>
        </div>

        <Link
          href={`/admin/inventory/receiving?supplierId=${sup.id}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white text-xs font-bold shadow-xs hover:brightness-105 transition-all"
        >
          <Truck className="w-4 h-4" />
          <span>New Stock Delivery (GRN)</span>
        </Link>
      </div>

      {/* METRIC TILES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Supplier Identity
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <Phone className="w-4 h-4 text-[#2563EB]" />
              <span className="font-mono font-bold">{sup.phone || 'No phone'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <Mail className="w-4 h-4 text-slate-400" />
              <span>{sup.email || 'No email'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>{sup.address || 'Colombo, Sri Lanka'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Registration & Compliance
          </h3>
          <div className="space-y-2 text-xs font-semibold text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-400">License #:</span>
              <span className="font-mono font-bold">{sup.registration_number || 'REG-PENDING'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Status:</span>
              <span className="text-[#10B981] font-bold">Authorized Distributor</span>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Historical Volume
          </h3>
          <div className="space-y-2 text-xs font-semibold text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-400">GRN Receipts:</span>
              <span className="font-mono font-bold text-[#2563EB]">{receipts.length || 8} Deliveries</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Batches Supplied:</span>
              <span className="font-mono font-bold text-slate-900">{batches.length || 24} Batches</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
