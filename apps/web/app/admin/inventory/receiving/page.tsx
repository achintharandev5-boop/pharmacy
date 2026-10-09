'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Truck,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRight,
  Barcode,
  Calendar,
  DollarSign,
  Boxes,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { receiveStock } from '@/app/actions/inventory';
import { getSuppliers } from '@/app/actions/suppliers';
import { getAdminProducts } from '@/app/actions/admin';
import PageHeader from '@/components/admin/PageHeader';
import InventoryTabs from '@/components/admin/InventoryTabs';

export default function StockReceivingWizardPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<any>(null);

  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [grnNumber, setGrnNumber] = useState(
    `GRN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-0001`
  );
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<any[]>([
    {
      productId: 'prod_1',
      productName: 'Paracetamol 500mg',
      batchNumber: 'BATCH-2026-A',
      quantity: 500,
      purchaseCost: 10.0,
      retailPrice: 15.0,
      manufacturedDate: '2026-01-01',
      expiryDate: '2028-06-30',
    },
  ]);

  useEffect(() => {
    async function loadInitial() {
      setLoading(true);
      try {
        const [supList, prodList] = await Promise.all([getSuppliers(), getAdminProducts()]);
        if (Array.isArray(supList)) {
          setSuppliers(supList);
          if (supList.length > 0) setSupplierId(supList[0].id);
        }
        if (Array.isArray(prodList)) setProducts(prodList);
      } catch (err) {
        console.error('Failed to load receiving data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitial();
  }, []);

  const handleAddItemRow = () => {
    const defaultProd = products[0] || { id: 'prod_1', name: 'Medicine' };
    setItems([
      ...items,
      {
        productId: defaultProd.id,
        productName: defaultProd.name,
        batchNumber: `BATCH-${Math.floor(Math.random() * 9000 + 1000)}`,
        quantity: 100,
        purchaseCost: 15.0,
        retailPrice: 20.0,
        manufacturedDate: '',
        expiryDate: '2027-12-31',
      },
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    const updated = [...items];
    updated[idx][field] = value;
    if (field === 'productId') {
      const p = products.find((prod) => prod.id === value);
      if (p) updated[idx].productName = p.name;
    }
    setItems(updated);
  };

  const handleSubmitGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        supplierId,
        invoiceNumber,
        grnNumber,
        receivedDate,
        notes,
        items,
      };

      const res = await receiveStock(payload);
      setSuccessResult(res || { grnNumber });
    } catch (err) {
      console.error('Failed to submit GRN:', err);
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
          <h1 className="text-2xl font-extrabold text-[#0F172A]">Stock Receipt Completed</h1>
          <p className="text-xs text-slate-500 font-medium">
            Goods Received Note <strong className="font-mono text-[#2563EB]">{successResult.grnNumber || grnNumber}</strong> has been committed.
          </p>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs font-semibold text-slate-700 space-y-1.5">
          <div>GRN Reference: <strong className="font-mono text-slate-900">{successResult.grnNumber || grnNumber}</strong></div>
          <div>Total Products Received: <strong>{items.length} items</strong></div>
          <div>Total Batch Units: <strong>{items.reduce((acc, i) => acc + Number(i.quantity || 0), 0)} units</strong></div>
          <div>Status: <strong className="text-[#10B981]">Committed to Database • FEFO Batches Updated • Movements Logged</strong></div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/admin/inventory/batches"
            className="px-4 py-2.5 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white rounded-xl text-xs font-bold shadow-xs hover:brightness-105"
          >
            View Active Batches
          </Link>
          <button
            type="button"
            onClick={() => {
              setSuccessResult(null);
            }}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold"
          >
            Receive Another Delivery
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      <PageHeader
        title="Stock Receiving (GRN)"
        subtitle="Record vendor deliveries, allocate FEFO batch numbers, verify purchase costs and update live catalog stock."
        icon={Truck}
      />

      <InventoryTabs />

      <form onSubmit={handleSubmitGRN} className="space-y-5">
        {/* VENDOR & INVOICE METADATA */}
        <div className="bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <h2 className="text-sm font-bold text-[#0F172A] border-b border-slate-100 pb-3">
            Invoice & Supplier Metadata
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Select Supplier *</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Invoice / Bill Number *</label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-99482"
                className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">GRN Identifier</label>
              <input
                type="text"
                value={grnNumber}
                onChange={(e) => setGrnNumber(e.target.value)}
                className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Received Date</label>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>
        </div>

        {/* DELIVERED MEDICINE BATCHES TABLE */}
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

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Batch Number</th>
                  <th className="py-2.5 px-3">Units</th>
                  <th className="py-2.5 px-3">Cost (LKR)</th>
                  <th className="py-2.5 px-3">Retail (LKR)</th>
                  <th className="py-2.5 px-3">Expiry Date</th>
                  <th className="py-2.5 px-3 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {items.map((row, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/30">
                    <td className="py-2.5 px-3">
                      <select
                        value={row.productId}
                        onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                        className="w-full h-8 px-2 bg-[#F8FBFF] border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-[#2563EB]"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={row.batchNumber}
                        onChange={(e) => handleItemChange(idx, 'batchNumber', e.target.value)}
                        className="w-28 h-8 px-2 bg-[#F8FBFF] border border-slate-200 rounded-lg font-mono font-bold text-xs"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                        className="w-20 h-8 px-2 bg-[#F8FBFF] border border-slate-200 rounded-lg font-mono font-bold text-xs"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        step="0.01"
                        value={row.purchaseCost}
                        onChange={(e) => handleItemChange(idx, 'purchaseCost', Number(e.target.value))}
                        className="w-24 h-8 px-2 bg-[#F8FBFF] border border-slate-200 rounded-lg font-mono font-bold text-xs"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        step="0.01"
                        value={row.retailPrice}
                        onChange={(e) => handleItemChange(idx, 'retailPrice', Number(e.target.value))}
                        className="w-24 h-8 px-2 bg-[#F8FBFF] border border-slate-200 rounded-lg font-mono font-bold text-xs"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="date"
                        value={row.expiryDate}
                        onChange={(e) => handleItemChange(idx, 'expiryDate', e.target.value)}
                        className="w-32 h-8 px-2 bg-[#F8FBFF] border border-slate-200 rounded-lg font-mono text-xs"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
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
              Total Units Received:{' '}
              <strong className="text-slate-900 font-mono">
                {items.reduce((acc, i) => acc + Number(i.quantity || 0), 0)}
              </strong>
            </span>

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
              <span>Commit & Receive Stock (GRN)</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
