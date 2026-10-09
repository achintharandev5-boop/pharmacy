'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Package,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  X,
  Eye,
} from 'lucide-react';
import { getAdminProducts } from '@/app/actions/admin';
import PageHeader from '@/components/admin/PageHeader';
import InventoryTabs from '@/components/admin/InventoryTabs';
import FilterTabs from '@/components/admin/FilterTabs';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';

export default function InventoryProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    generic_name: '',
    brand_name: '',
    category: 'Antibiotics',
    dosage_form: 'Capsule',
    strength: '500mg',
    manufacturer: '',
    sku: '',
    barcode: '',
    purchase_cost: '18.50',
    retail_price: '25.00',
    reorder_level: '15',
    minimum_stock: '5',
    maximum_stock: '500',
    batch_tracking_enabled: true,
    expiry_tracking_enabled: true,
    rx_required: true,
    is_active: true,
  });

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      try {
        const data = await getAdminProducts(
          searchTerm,
          categoryFilter === 'ALL' ? undefined : categoryFilter,
          statusFilter === 'ALL' ? undefined : statusFilter
        );
        if (Array.isArray(data)) setProducts(data);
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [searchTerm, statusFilter, categoryFilter]);

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const newProd = {
      id: `prod_${Date.now()}`,
      name: formData.name,
      generic_name: formData.generic_name || formData.name,
      brand_name: formData.brand_name,
      category: formData.category,
      dosage_form: formData.dosage_form,
      strength: formData.strength,
      barcode: formData.barcode || `893400${Math.floor(Math.random() * 90 + 10)}`,
      sku: formData.sku || `SKU-${Math.floor(Math.random() * 900 + 100)}`,
      stock_quantity: 0,
      unit_price: parseFloat(formData.retail_price) || 0,
      purchase_cost: parseFloat(formData.purchase_cost) || 0,
      reorder_level: parseInt(formData.reorder_level, 10) || 15,
      expiry_date: '2027-12-31',
    };

    setProducts([newProd, ...products]);
    setShowAddModal(false);
    setSaveSuccessMsg(`Product "${formData.name}" added successfully.`);
    setTimeout(() => setSaveSuccessMsg(null), 5000);
  };

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      <PageHeader
        title="Medicine Catalog & Product Directory"
        subtitle="Manage pharmaceutical items, FEFO batch settings, reorder levels, and prices."
        icon={Package}
        actions={[
          {
            label: '+ Add New Medicine',
            onClick: () => setShowAddModal(true),
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
        </div>
      )}

      {/* SEARCH & FILTERS BAR */}
      <div className="bg-white/88 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search medicine name, generic name, barcode or SKU..."
            className="w-full h-[40px] pl-10 pr-4 bg-[#F8FBFF] border border-slate-200 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 rounded-xl text-xs font-semibold outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <FilterTabs
            tabs={[
              { id: 'ALL', label: 'All' },
              { id: 'in', label: 'In Stock' },
              { id: 'low', label: 'Low Stock' },
              { id: 'out', label: 'Out of Stock' },
            ]}
            activeTab={statusFilter}
            onChange={(st) => setStatusFilter(st)}
          />

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
          >
            <option value="ALL">All Categories</option>
            <option value="Antibiotics">Antibiotics</option>
            <option value="Cardiovascular">Cardiovascular</option>
            <option value="Antidiabetic">Antidiabetic</option>
            <option value="Analgesics">Analgesics</option>
            <option value="Gastrointestinal">Gastrointestinal</option>
          </select>
        </div>
      </div>

      {/* PRODUCTS TABLE */}
      <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Medicine / Brand</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Barcode / SKU</th>
                <th className="py-3.5 px-4 text-center">Stock Level</th>
                <th className="py-3.5 px-4">Retail Price</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                    <div className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading products catalog...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length > 0 ? (
                products.map((p) => {
                  const stock = Number(p.stock_quantity || 0);
                  const isOut = stock <= 0;
                  const isLow = stock > 0 && stock <= (p.reorder_level || 15);

                  let statusText = 'In Stock';
                  if (isOut) statusText = 'Out of Stock';
                  else if (isLow) statusText = 'Low Stock';

                  return (
                    <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <span className="text-[13px] font-bold text-[#0F172A] block leading-tight">
                          {p.name}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {p.generic_name || p.brand_name || 'Generic'} • {p.strength || 'Standard'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-600">
                        {p.category || 'General'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500">
                        {p.barcode || p.sku || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-center text-slate-900">
                        {stock} units
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        LKR {Number(p.unit_price || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={statusText} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/admin/products/${p.id || 'prod_1'}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-blue-50 text-[#2563EB] border border-blue-200 hover:border-blue-300 font-bold rounded-xl text-xs transition-colors shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          <span>View SKU</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="No medicines found"
                      description={`No products matched your search "${searchTerm}".`}
                      actionText="+ Add New Medicine"
                      onAction={() => setShowAddModal(true)}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD MEDICINE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 z-10 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#0F172A]">Add New Medicine</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddProductSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Brand / Commercial Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Panadol Extra 500mg"
                  className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Generic Formula</label>
                  <input
                    type="text"
                    value={formData.generic_name}
                    onChange={(e) => setFormData({ ...formData, generic_name: e.target.value })}
                    placeholder="Paracetamol"
                    className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#2563EB]"
                  >
                    <option value="Antibiotics">Antibiotics</option>
                    <option value="Cardiovascular">Cardiovascular</option>
                    <option value="Antidiabetic">Antidiabetic</option>
                    <option value="Analgesics">Analgesics</option>
                    <option value="Gastrointestinal">Gastrointestinal</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Barcode</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="893400..."
                    className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Retail Price (LKR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.retail_price}
                    onChange={(e) => setFormData({ ...formData, retail_price: e.target.value })}
                    className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Reorder Threshold</label>
                  <input
                    type="number"
                    value={formData.reorder_level}
                    onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                    className="w-full h-10 px-3 bg-[#F8FBFF] border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-[#2563EB]"
                  />
                </div>
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
                  className="px-4 py-2 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white rounded-xl text-xs font-bold shadow-xs hover:brightness-105"
                >
                  Save Medicine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
