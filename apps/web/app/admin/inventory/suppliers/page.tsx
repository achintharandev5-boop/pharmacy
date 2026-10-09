'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Truck, Search, Plus, Phone, Mail, MapPin, ArrowRight, CheckCircle2, X } from 'lucide-react';
import { getSuppliers, createSupplier } from '@/app/actions/suppliers';
import PageHeader from '@/components/admin/PageHeader';
import InventoryTabs from '@/components/admin/InventoryTabs';
import EmptyState from '@/components/admin/EmptyState';
import { ActionError, ErrorState, LoadingState, MISSING } from '@/components/admin/DataState';
import { useApiQuery } from '@/lib/useApiQuery';

export default function SupplierManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const suppliersQuery = useApiQuery(() => getSuppliers(searchTerm), [searchTerm]);
  const suppliers = suppliersQuery.data ?? [];

  const emptyForm = {
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    registration_number: '',
    notes: '',
  };
  const [formData, setFormData] = useState(emptyForm);

  const openAddModal = () => {
    setSaveError(null);
    setShowAddModal(true);
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || saving) return;

    setSaving(true);
    setSaveError(null);
    try {
      const res = await createSupplier(formData);
      if (!res.ok) {
        setSaveError(`Supplier was not saved: ${res.error}`);
        return;
      }
      setShowAddModal(false);
      setSaveSuccessMsg(`Supplier "${formData.name.trim()}" saved.`);
      setFormData(emptyForm);
      suppliersQuery.retry();
    } catch {
      setSaveError('Supplier was not saved: the pharmacy server could not be reached.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      <PageHeader
        title="Suppliers"
        subtitle="Supplier contact details and stock receiving (GRN)."
        icon={Truck}
        actions={[
          {
            label: '+ Add Supplier',
            onClick: openAddModal,
            variant: 'primary',
          },
        ]}
      />

      <InventoryTabs />

      {saveSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button type="button" onClick={() => setSaveSuccessMsg(null)} className="text-emerald-800 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* SEARCH BAR */}
      <div className="bg-white/88 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search suppliers by name, email, or registration number..."
            className="w-full h-[40px] pl-10 pr-4 bg-[#F8FBFF] border border-slate-200 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 rounded-xl text-xs font-semibold outline-none transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* SUPPLIERS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {suppliersQuery.status === 'loading' ? (
          <div className="col-span-full">
            <LoadingState label="Loading suppliers…" />
          </div>
        ) : suppliersQuery.status === 'error' ? (
          <div className="col-span-full bg-white rounded-2xl border border-slate-200">
            <ErrorState title="Could not load suppliers" message={suppliersQuery.error} onRetry={suppliersQuery.retry} />
          </div>
        ) : suppliers.length > 0 ? (
          suppliers.map((s) => (
            <div
              key={s.id}
              className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] hover:border-blue-300 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-[#2563EB] flex items-center justify-center font-bold text-sm shadow-2xs">
                      {s.name ? s.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#0F172A] leading-tight">
                        {s.name || MISSING}
                      </h3>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Reg: {s.registration_number || MISSING}
                      </span>
                    </div>
                  </div>
                  {s.active === true && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#10B981] border border-emerald-200">
                      Active
                    </span>
                  )}
                  {s.active === false && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span className="font-mono">{s.phone || MISSING}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{s.email || MISSING}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{s.address || MISSING}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                <Link
                  href={`/admin/inventory/receiving?supplierId=${s.id}`}
                  className="text-xs font-bold text-[#2563EB] hover:underline"
                >
                  Create GRN &rarr;
                </Link>
                <Link
                  href={`/admin/inventory/suppliers/${s.id}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900"
                >
                  <span>Profile</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full">
            <EmptyState
              title="No suppliers found"
              description={
                searchTerm
                  ? 'No suppliers match your search.'
                  : 'No suppliers have been added yet. Add a supplier to record stock receipts against it.'
              }
              actionText="+ Add Supplier"
              onAction={openAddModal}
            />
          </div>
        )}
      </div>

      {/* ADD SUPPLIER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 z-10 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#0F172A]">Register New Supplier</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSupplier} className="space-y-3">
              {saveError && <ActionError message={saveError} />}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. State Pharmaceuticals Corporation"
                  className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="011-2345678"
                    className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Registration #</label>
                  <input
                    type="text"
                    value={formData.registration_number}
                    onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                    placeholder="NMRA-2026"
                    className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="orders@supplier.lk"
                  className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Physical Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Distribution Center, Colombo"
                  className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white rounded-xl text-xs font-bold shadow-xs hover:brightness-105 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
