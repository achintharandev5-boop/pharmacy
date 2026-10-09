'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Truck, Plus, Trash2, CheckCircle2, RefreshCw } from 'lucide-react';
import { receiveStock } from '@/app/actions/inventory';
import { getSuppliers } from '@/app/actions/suppliers';
import { getAdminProducts } from '@/app/actions/admin';
import PageHeader from '@/components/admin/PageHeader';
import InventoryTabs from '@/components/admin/InventoryTabs';
import { ActionError, ErrorState, LoadingState } from '@/components/admin/DataState';
import { useApiQuery } from '@/lib/useApiQuery';

interface GrnLine {
  productId: string;
  productName: string;
  batchNumber: string;
  quantity: string;
  purchaseCost: string;
  retailPrice: string;
  expiryDate: string;
}

// Every line starts blank: batch numbers, quantities, prices and expiry dates must come from the delivery.
const emptyLine = (): GrnLine => ({
  productId: '',
  productName: '',
  batchNumber: '',
  quantity: '',
  purchaseCost: '',
  retailPrice: '',
  expiryDate: '',
});

export default function StockReceivingWizardPage() {
  const suppliersQuery = useApiQuery(() => getSuppliers(), []);
  const productsQuery = useApiQuery(() => getAdminProducts(), []);
  const suppliers = suppliersQuery.data ?? [];
  const products = productsQuery.data ?? [];

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ grnNumber?: string; lines: number; units: number } | null>(null);

  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [grnNumber, setGrnNumber] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes] = useState('');
  const [items, setItems] = useState<GrnLine[]>([emptyLine()]);

  const totalUnits = items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);

  const handleAddItemRow = () => setItems([...items, emptyLine()]);

  const handleRemoveItemRow = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: keyof GrnLine, value: string) => {
    const updated = items.map((row, i) => (i === idx ? { ...row, [field]: value } : row));
    if (field === 'productId') {
      const p = products.find((prod) => prod.id === value);
      updated[idx].productName = p?.name ?? '';
    }
    setItems(updated);
  };

  const resetForm = () => {
    setSupplierId('');
    setInvoiceNumber('');
    setGrnNumber('');
    setReceivedDate(new Date().toISOString().split('T')[0]);
    setItems([emptyLine()]);
  };

  const handleSubmitGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const invalid = items.findIndex(
      (i) => !i.productId || !i.batchNumber.trim() || !(Number(i.quantity) > 0) || i.purchaseCost === '' || !i.expiryDate,
    );
    if (!supplierId) {
      setSubmitError('Select the supplier for this delivery.');
      return;
    }
    if (invalid !== -1) {
      setSubmitError(`Line ${invalid + 1} is incomplete: product, batch number, quantity, cost and expiry date are required.`);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await receiveStock({
        supplierId,
        invoiceNumber,
        grnNumber: grnNumber.trim() || undefined,
        receivedDate,
        notes,
        items: items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          batchNumber: i.batchNumber.trim(),
          quantity: Number(i.quantity),
          purchaseCost: Number(i.purchaseCost),
          retailPrice: i.retailPrice === '' ? undefined : Number(i.retailPrice),
          expiryDate: i.expiryDate,
        })),
      });
      if (!res.ok) {
        setSubmitError(`Stock was not received: ${res.error}`);
        return;
      }
      setSuccessResult({ grnNumber: res.data?.grnNumber, lines: items.length, units: totalUnits });
      resetForm();
    } catch {
      setSubmitError('Stock was not received: the pharmacy server could not be reached.');
    } finally {
      setSubmitting(false);
    }
  };

  if (successResult) {
    return (
      <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_8px_30px_rgba(15,23,42,0.04)] p-8 max-w-2xl mx-auto space-y-6 text-center select-none font-sans mt-6">
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#10B981] mx-auto flex items-center justify-center border border-emerald-200">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-[#0F172A]">Stock Receipt Recorded</h1>
          <p className="text-xs text-slate-500 font-medium">The server confirmed this goods received note.</p>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs font-semibold text-slate-700 space-y-1.5">
          {successResult.grnNumber && (
            <div>
              GRN Reference: <strong className="font-mono text-slate-900">{successResult.grnNumber}</strong>
            </div>
          )}
          <div>
            Lines received: <strong>{successResult.lines}</strong>
          </div>
          <div>
            Units received: <strong>{successResult.units}</strong>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/admin/inventory/batches"
            className="px-4 py-2.5 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white rounded-xl text-xs font-bold shadow-xs hover:brightness-105"
          >
            View Batches
          </Link>
          <button
            type="button"
            onClick={() => setSuccessResult(null)}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold"
          >
            Receive Another Delivery
          </button>
        </div>
      </div>
    );
  }

  const header = (
    <>
      <PageHeader
        title="Stock Receiving (GRN)"
        subtitle="Record supplier deliveries with batch numbers, quantities, costs and expiry dates."
        icon={Truck}
      />
      <InventoryTabs />
    </>
  );

  if (suppliersQuery.status === 'loading' || productsQuery.status === 'loading') {
    return (
      <div className="space-y-6 select-none font-sans text-[#0F172A]">
        {header}
        <LoadingState label="Loading suppliers and products…" />
      </div>
    );
  }

  if (suppliersQuery.status === 'error' || productsQuery.status === 'error') {
    const failed = suppliersQuery.status === 'error' ? suppliersQuery : productsQuery;
    return (
      <div className="space-y-6 select-none font-sans text-[#0F172A]">
        {header}
        <div className="bg-white rounded-2xl border border-slate-200">
          <ErrorState
            title="Could not load the receiving form"
            message={failed.error ?? ''}
            onRetry={() => {
              suppliersQuery.retry();
              productsQuery.retry();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {header}

      <form onSubmit={handleSubmitGRN} className="space-y-5" noValidate>
        {submitError && <ActionError message={submitError} onDismiss={() => setSubmitError(null)} />}

        {/* SUPPLIER & INVOICE */}
        <div className="bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <h2 className="text-sm font-bold text-[#0F172A] border-b border-slate-100 pb-3">Invoice & Supplier</h2>

          {suppliers.length === 0 && (
            <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              No suppliers exist yet.{' '}
              <Link href="/admin/inventory/suppliers" className="underline">
                Add a supplier
              </Link>{' '}
              before receiving stock.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="grn-supplier" className="text-xs font-bold text-slate-700">
                Supplier *
              </label>
              <select
                id="grn-supplier"
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
              >
                <option value="">Select supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="grn-invoice" className="text-xs font-bold text-slate-700">
                Invoice / Bill Number
              </label>
              <input
                id="grn-invoice"
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="grn-number" className="text-xs font-bold text-slate-700">
                GRN Number
              </label>
              <input
                id="grn-number"
                type="text"
                value={grnNumber}
                onChange={(e) => setGrnNumber(e.target.value)}
                placeholder="Assigned by the server if blank"
                className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-[#2563EB] placeholder:font-sans placeholder:font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="grn-date" className="text-xs font-bold text-slate-700">
                Received Date
              </label>
              <input
                id="grn-date"
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>
        </div>

        {/* DELIVERED BATCHES */}
        <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-[#0F172A]">Delivered Batches & Quantities</h2>
            <button
              type="button"
              onClick={handleAddItemRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#2563EB] rounded-xl text-xs font-bold border border-blue-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Batch Line</span>
            </button>
          </div>

          {products.length === 0 && (
            <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              No products exist in the catalog yet, so there is nothing to receive stock against.
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3">Product *</th>
                  <th className="py-2.5 px-3">Batch Number *</th>
                  <th className="py-2.5 px-3">Units *</th>
                  <th className="py-2.5 px-3">Cost (LKR) *</th>
                  <th className="py-2.5 px-3">Retail (LKR)</th>
                  <th className="py-2.5 px-3">Expiry Date *</th>
                  <th className="py-2.5 px-3 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {items.map((row, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/30">
                    <td className="py-2.5 px-3">
                      <select
                        aria-label={`Line ${idx + 1} product`}
                        value={row.productId}
                        onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                        className="w-full h-8 px-2 bg-[#F8FBFF] border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-[#2563EB]"
                      >
                        <option value="">Select product…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        aria-label={`Line ${idx + 1} batch number`}
                        type="text"
                        value={row.batchNumber}
                        onChange={(e) => handleItemChange(idx, 'batchNumber', e.target.value)}
                        className="w-28 h-8 px-2 bg-[#F8FBFF] border border-slate-200 rounded-lg font-mono font-bold text-xs"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        aria-label={`Line ${idx + 1} units`}
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-20 h-8 px-2 bg-[#F8FBFF] border border-slate-200 rounded-lg font-mono font-bold text-xs"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        aria-label={`Line ${idx + 1} cost`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.purchaseCost}
                        onChange={(e) => handleItemChange(idx, 'purchaseCost', e.target.value)}
                        className="w-24 h-8 px-2 bg-[#F8FBFF] border border-slate-200 rounded-lg font-mono font-bold text-xs"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        aria-label={`Line ${idx + 1} retail price`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.retailPrice}
                        onChange={(e) => handleItemChange(idx, 'retailPrice', e.target.value)}
                        className="w-24 h-8 px-2 bg-[#F8FBFF] border border-slate-200 rounded-lg font-mono font-bold text-xs"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        aria-label={`Line ${idx + 1} expiry date`}
                        type="date"
                        value={row.expiryDate}
                        onChange={(e) => handleItemChange(idx, 'expiryDate', e.target.value)}
                        className="w-32 h-8 px-2 bg-[#F8FBFF] border border-slate-200 rounded-lg font-mono text-xs"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        aria-label={`Remove line ${idx + 1}`}
                        onClick={() => handleRemoveItemRow(idx)}
                        disabled={items.length <= 1}
                        className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Total Units: <strong className="text-slate-900 font-mono">{totalUnits}</strong>
            </span>

            <button
              type="submit"
              disabled={submitting || suppliers.length === 0 || products.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white rounded-xl text-xs font-bold shadow-xs hover:brightness-105 disabled:opacity-50"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{submitting ? 'Saving…' : 'Receive Stock (GRN)'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
