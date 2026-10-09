'use client';

import React, { useState } from 'react';
import { SlidersHorizontal, CheckCircle2, ArrowRight, RefreshCw } from 'lucide-react';
import { adjustStock, getInventoryBatches } from '@/app/actions/inventory';
import { getAdminProducts } from '@/app/actions/admin';
import PageHeader from '@/components/admin/PageHeader';
import InventoryTabs from '@/components/admin/InventoryTabs';
import { ActionError, ErrorState, LoadingState, MISSING } from '@/components/admin/DataState';
import { useApiQuery } from '@/lib/useApiQuery';

type AdjustmentType = 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'EXPIRED' | 'DAMAGED' | 'RETURNED';

const TYPE_LABELS: Record<AdjustmentType, string> = {
  ADJUSTMENT_OUT: 'Decrease Stock (Physical Discrepancy / Shrinkage)',
  ADJUSTMENT_IN: 'Increase Stock (Found Stock / Recount)',
  DAMAGED: 'Damaged / Broken Units',
  EXPIRED: 'Expired Batch Write-off',
  RETURNED: 'Customer Return to Stock',
};

export default function StockAdjustmentsPage() {
  const productsQuery = useApiQuery(() => getAdminProducts(), []);
  const batchesQuery = useApiQuery(() => getInventoryBatches(), []);
  const products = productsQuery.data ?? [];
  const batches = batchesQuery.data ?? [];

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [productId, setProductId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('ADJUSTMENT_OUT');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  const selectedProduct = products.find((p) => p.id === productId);
  const currentStock = typeof selectedProduct?.stock_quantity === 'number' ? selectedProduct.stock_quantity : null;
  const qty = Number(quantity);
  const hasQty = Number.isFinite(qty) && qty > 0;
  const isDecrease = ['ADJUSTMENT_OUT', 'EXPIRED', 'DAMAGED'].includes(adjustmentType);
  const newStock = currentStock !== null && hasQty ? Math.max(0, currentStock + (isDecrease ? -qty : qty)) : null;

  const filteredBatches = batches.filter((b) => b.product_id === productId);

  const handleConfirmAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!selectedProduct) {
      setSubmitError('Select the medicine to adjust.');
      return;
    }
    if (!hasQty || !Number.isInteger(qty)) {
      setSubmitError('Enter a whole number of units greater than zero.');
      return;
    }
    if (!reason.trim()) {
      setSubmitError('Enter a justification. It is recorded with the stock movement.');
      return;
    }

    const confirmed = window.confirm(
      `${TYPE_LABELS[adjustmentType]}\n\n${selectedProduct.name}: ${isDecrease ? '-' : '+'}${qty} unit(s).\n\nThis changes recorded stock. Continue?`,
    );
    if (!confirmed) return;

    setSubmitting(true);
    setSuccessMsg(null);
    setSubmitError(null);
    try {
      const res = await adjustStock({
        productId,
        batchId: batchId || undefined,
        type: adjustmentType,
        quantity: qty,
        reason: reason.trim(),
      });
      if (!res.ok) {
        setSubmitError(`Stock was not adjusted: ${res.error}`);
        return;
      }
      setSuccessMsg(`Stock adjusted for ${selectedProduct.name}: ${isDecrease ? '-' : '+'}${qty} unit(s).`);
      setQuantity('');
      setReason('');
      productsQuery.retry();
      batchesQuery.retry();
    } catch {
      setSubmitError('Stock was not adjusted: the pharmacy server could not be reached.');
    } finally {
      setSubmitting(false);
    }
  };

  const header = (
    <>
      <PageHeader
        title="Stock Adjustments"
        subtitle="Record count corrections, damaged units, expired write-offs and returns."
        icon={SlidersHorizontal}
      />
      <InventoryTabs />
    </>
  );

  if (productsQuery.status === 'loading' || batchesQuery.status === 'loading') {
    return (
      <div className="space-y-6 select-none font-sans text-[#0F172A]">
        {header}
        <LoadingState label="Loading products and batches…" />
      </div>
    );
  }

  if (productsQuery.status === 'error' || batchesQuery.status === 'error') {
    const failed = productsQuery.status === 'error' ? productsQuery : batchesQuery;
    return (
      <div className="space-y-6 select-none font-sans text-[#0F172A]">
        {header}
        <div className="bg-white rounded-2xl border border-slate-200">
          <ErrorState
            title="Could not load the adjustment form"
            message={failed.error ?? ''}
            onRetry={() => {
              productsQuery.retry();
              batchesQuery.retry();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {header}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-800 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleConfirmAdjustment} className="space-y-5" noValidate>
        {submitError && <ActionError message={submitError} onDismiss={() => setSubmitError(null)} />}

        <div className="bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <h2 className="text-sm font-bold text-[#0F172A] border-b border-slate-100 pb-3">Adjustment Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="adj-product" className="text-xs font-bold text-slate-700">
                Medicine *
              </label>
              <select
                id="adj-product"
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setBatchId('');
                }}
                className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
              >
                <option value="">Select medicine…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {typeof p.stock_quantity === 'number' ? ` (Current: ${p.stock_quantity} units)` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="adj-batch" className="text-xs font-bold text-slate-700">
                Batch (optional)
              </label>
              <select
                id="adj-batch"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                disabled={!productId}
                className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB] disabled:opacity-60"
              >
                <option value="">No specific batch (product total only)</option>
                {filteredBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    Batch {b.batch_number || MISSING} (Exp: {b.expiry_date || MISSING})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="adj-type" className="text-xs font-bold text-slate-700">
                Adjustment Type *
              </label>
              <select
                id="adj-type"
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value as AdjustmentType)}
                className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
              >
                {(Object.keys(TYPE_LABELS) as AdjustmentType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="adj-qty" className="text-xs font-bold text-slate-700">
                Units *
              </label>
              <input
                id="adj-qty"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="adj-reason" className="text-xs font-bold text-slate-700">
              Justification *
            </label>
            <input
              id="adj-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is stock being adjusted? This is recorded with the movement."
              className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
            />
          </div>

          {/* STOCK PREVIEW */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 font-bold block uppercase text-[10px]">Current Stock</span>
              <span className="text-base font-extrabold text-[#0F172A]">
                {currentStock !== null ? `${currentStock} units` : MISSING}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <div>
              <span className="text-slate-400 font-bold block uppercase text-[10px]">Change</span>
              <span className={`text-base font-extrabold ${isDecrease ? 'text-rose-600' : 'text-[#10B981]'}`}>
                {hasQty ? `${isDecrease ? '-' : '+'}${qty} units` : MISSING}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <div>
              <span className="text-slate-400 font-bold block uppercase text-[10px]">Expected New Stock</span>
              <span className="text-base font-extrabold text-[#2563EB]">{newStock !== null ? `${newStock} units` : MISSING}</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting || products.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white rounded-xl text-xs font-bold shadow-xs hover:brightness-105 disabled:opacity-50"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{submitting ? 'Saving…' : 'Record Adjustment'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
