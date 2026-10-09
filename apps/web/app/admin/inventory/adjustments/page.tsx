'use client';

import React, { useEffect, useState } from 'react';
import { SlidersHorizontal, CheckCircle2, ArrowRight, RefreshCw, AlertTriangle } from 'lucide-react';
import { adjustStock, getInventoryBatches } from '@/app/actions/inventory';
import { getAdminProducts } from '@/app/actions/admin';
import PageHeader from '@/components/admin/PageHeader';
import InventoryTabs from '@/components/admin/InventoryTabs';

export default function StockAdjustmentsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [productId, setProductId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<
    'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'EXPIRED' | 'DAMAGED' | 'RETURNED'
  >('ADJUSTMENT_OUT');
  const [quantity, setQuantity] = useState(5);
  const [reason, setReason] = useState('Stock Count Correction');
  const [note, setNote] = useState('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [prodList, batchList] = await Promise.all([getAdminProducts(), getInventoryBatches()]);
        if (Array.isArray(prodList)) {
          setProducts(prodList);
          if (prodList.length > 0) setProductId(prodList[0].id);
        }
        if (Array.isArray(batchList)) setBatches(batchList);
      } catch (err) {
        console.error('Failed to load adjustment data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const selectedProduct =
    products.find((p) => p.id === productId) || products[0] || { stock_quantity: 542 };
  const currentStock = Number(selectedProduct.stock_quantity || 0);
  const isDecrease = ['ADJUSTMENT_OUT', 'EXPIRED', 'DAMAGED'].includes(adjustmentType);
  const shiftQty = isDecrease ? -Math.abs(quantity) : Math.abs(quantity);
  const newStock = Math.max(0, currentStock + shiftQty);

  const filteredBatches = batches.filter((b) => b.product_id === productId || !b.product_id);

  const handleConfirmAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg(null);

    try {
      const payload = {
        productId,
        batchId: batchId || undefined,
        type: adjustmentType,
        quantity: Math.abs(quantity),
        reason,
        notes: note,
      };

      await adjustStock(payload);
      setSuccessMsg(
        `Inventory successfully adjusted for ${selectedProduct.name}. Delta: ${
          isDecrease ? '-' : '+'
        }${quantity} units.`
      );
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      <PageHeader
        title="Inventory Reconciliation & Stock Adjustments"
        subtitle="Perform physical count corrections, record damaged units, write-off expired batches, and reconcile stock."
        icon={SlidersHorizontal}
      />

      <InventoryTabs />

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span>{successMsg}</span>
          </div>
        </div>
      )}

      {/* ADJUSTMENT WORKBENCH FORM */}
      <form onSubmit={handleConfirmAdjustment} className="space-y-5">
        <div className="bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <h2 className="text-sm font-bold text-[#0F172A] border-b border-slate-100 pb-3">
            Stock Adjustment Parameters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Select Medicine *</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Current: {p.stock_quantity ?? 0} units)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Optional Specific Batch</label>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
              >
                <option value="">Apply across general catalog pool</option>
                {filteredBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    Batch {b.batch_number} (Exp: {b.expiry_date})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Adjustment Type *</label>
              <select
                value={adjustmentType}
                onChange={(e: any) => setAdjustmentType(e.target.value)}
                className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
              >
                <option value="ADJUSTMENT_OUT">Decrease Stock (Physical Discrepancy / Shrinkage)</option>
                <option value="ADJUSTMENT_IN">Increase Stock (Found Stock / Recount)</option>
                <option value="DAMAGED">Damaged / Broken Vials</option>
                <option value="EXPIRED">Expired Batch Write-off</option>
                <option value="RETURNED">Customer Return to Stock</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Units Quantity *</label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Audit Justification / Notes</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Monthly physical shelf audit count reconciled by Pharmacist"
              className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
            />
          </div>

          {/* STOCK RECONCILIATION PREVIEW */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 font-bold block uppercase text-[10px]">Current Stock</span>
              <span className="text-base font-extrabold text-[#0F172A]">{currentStock} units</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <div>
              <span className="text-slate-400 font-bold block uppercase text-[10px]">Adjustment Delta</span>
              <span
                className={`text-base font-extrabold ${
                  isDecrease ? 'text-rose-600' : 'text-[#10B981]'
                }`}
              >
                {isDecrease ? `-${quantity}` : `+${quantity}`} units
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <div>
              <span className="text-slate-400 font-bold block uppercase text-[10px]">Reconciled New Stock</span>
              <span className="text-base font-extrabold text-[#2563EB]">{newStock} units</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white rounded-xl text-xs font-bold shadow-xs hover:brightness-105 disabled:opacity-50"
            >
              {submitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Commit Inventory Adjustment</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
