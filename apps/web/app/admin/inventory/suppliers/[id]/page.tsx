'use client';

import React, { use } from 'react';
import Link from 'next/link';
import { Truck, ArrowLeft, Phone, Mail, MapPin } from 'lucide-react';
import { getSupplierById } from '@/app/actions/suppliers';
import { ErrorState, LoadingState, MISSING } from '@/components/admin/DataState';
import { useApiQuery } from '@/lib/useApiQuery';
import type { ApiData } from '@/lib/api/types';

export default function Supplier360Page({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const supplierId = resolvedParams.id;

  const supplierQuery = useApiQuery(() => getSupplierById(supplierId), [supplierId]);

  if (supplierQuery.status === 'loading') {
    return <LoadingState label="Loading supplier…" />;
  }

  if (supplierQuery.status === 'error') {
    return (
      <div className="space-y-4 select-none font-sans">
        <Link href="/admin/inventory/suppliers" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" />
          Back to suppliers
        </Link>
        <div className="bg-white rounded-2xl border border-slate-200">
          <ErrorState
            title={supplierQuery.error.includes('not found') ? 'Supplier not found' : 'Could not load supplier'}
            message={supplierQuery.error}
            onRetry={supplierQuery.retry}
          />
        </div>
      </div>
    );
  }

  const data = supplierQuery.data;
  const sup = data.supplier ?? data;
  const batches: ApiData[] | undefined = Array.isArray(data.suppliedBatches) ? data.suppliedBatches : undefined;
  const receipts: ApiData[] | undefined = Array.isArray(data.receipts) ? data.receipts : undefined;

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/88 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-3.5">
          <Link
            href="/admin/inventory/suppliers"
            aria-label="Back to suppliers"
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">
                {sup.name || MISSING}
              </h1>
              {sup.active === true && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-[#10B981] border border-emerald-200">
                  Active
                </span>
              )}
              {sup.active === false && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-xs sm:text-[13px] font-medium text-[#64748B] mt-0.5">
              Supplier details, stock receipts and supplied batches
            </p>
          </div>
        </div>

        {sup.id && (
          <Link
            href={`/admin/inventory/receiving?supplierId=${sup.id}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white text-xs font-bold shadow-xs hover:brightness-105 transition-all"
          >
            <Truck className="w-4 h-4" />
            <span>New Stock Delivery (GRN)</span>
          </Link>
        )}
      </div>

      {/* DETAIL TILES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Contact
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="text-slate-400 w-14 shrink-0">Contact</span>
              <span className="font-semibold">{sup.contact_person || MISSING}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <Phone className="w-4 h-4 text-[#2563EB]" aria-label="Phone" />
              <span className="font-mono font-bold">{sup.phone || MISSING}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <Mail className="w-4 h-4 text-slate-400" aria-label="Email" />
              <span>{sup.email || MISSING}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <MapPin className="w-4 h-4 text-slate-400" aria-label="Address" />
              <span>{sup.address || MISSING}</span>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Registration
          </h3>
          <div className="space-y-2 text-xs font-semibold text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-400">Registration #:</span>
              <span className="font-mono font-bold">{sup.registration_number || MISSING}</span>
            </div>
            {sup.notes && (
              <div className="pt-1">
                <span className="text-slate-400 block">Notes:</span>
                <span className="font-medium">{sup.notes}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            History
          </h3>
          <div className="space-y-2 text-xs font-semibold text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-400">GRN receipts:</span>
              <span className="font-mono font-bold text-[#2563EB]">{receipts ? receipts.length : MISSING}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Batches supplied:</span>
              <span className="font-mono font-bold text-slate-900">{batches ? batches.length : MISSING}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
