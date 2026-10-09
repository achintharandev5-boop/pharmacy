'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, Package, Eye } from 'lucide-react';
import { getAdminProducts } from '@/app/actions/admin';
import PageHeader from '@/components/admin/PageHeader';
import InventoryTabs from '@/components/admin/InventoryTabs';
import FilterTabs from '@/components/admin/FilterTabs';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import { ErrorState, LoadingState, MISSING } from '@/components/admin/DataState';
import { useApiQuery } from '@/lib/useApiQuery';

const ADD_PRODUCT_UNAVAILABLE =
  'Adding medicines is not available yet: the API has no endpoint to save new products.';

export default function InventoryProductsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const productsQuery = useApiQuery(
    () =>
      getAdminProducts(
        searchTerm,
        categoryFilter === 'ALL' ? undefined : categoryFilter,
        statusFilter === 'ALL' ? undefined : statusFilter,
      ),
    [searchTerm, statusFilter, categoryFilter],
  );
  const products = productsQuery.data ?? [];

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      <PageHeader
        title="Medicine Catalog"
        subtitle="Medicines and products with stock levels, reorder levels and prices."
        icon={Package}
        actions={[
          {
            label: '+ Add New Medicine',
            variant: 'primary',
            disabled: true,
            disabledReason: ADD_PRODUCT_UNAVAILABLE,
          },
        ]}
      />

      <InventoryTabs />

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
              {productsQuery.status === 'loading' ? (
                <tr>
                  <td colSpan={7}>
                    <LoadingState label="Loading products…" />
                  </td>
                </tr>
              ) : productsQuery.status === 'error' ? (
                <tr>
                  <td colSpan={7}>
                    <ErrorState title="Could not load products" message={productsQuery.error} onRetry={productsQuery.retry} />
                  </td>
                </tr>
              ) : products.length > 0 ? (
                products.map((p) => {
                  const stock = typeof p.stock_quantity === 'number' ? p.stock_quantity : null;
                  const reorderLevel = typeof p.reorder_level === 'number' ? p.reorder_level : null;
                  const price = p.unit_price ?? p.retail_price;

                  // Status is only shown when it can be derived from recorded values.
                  let statusText: string | null = null;
                  if (stock !== null) {
                    if (stock <= 0) statusText = 'Out of Stock';
                    else if (reorderLevel !== null && stock <= reorderLevel) statusText = 'Low Stock';
                    else statusText = 'In Stock';
                  }

                  return (
                    <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <span className="text-[13px] font-bold text-[#0F172A] block leading-tight">
                          {p.name || MISSING}
                        </span>
                        {(p.generic_name || p.brand_name || p.strength) && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            {[p.generic_name || p.brand_name, p.strength].filter(Boolean).join(' • ')}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-600">
                        {p.category || MISSING}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500">
                        {p.barcode || p.sku || MISSING}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-center text-slate-900">
                        {stock !== null ? `${stock} units` : MISSING}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {price !== undefined && price !== null && Number.isFinite(Number(price))
                          ? `LKR ${Number(price).toFixed(2)}`
                          : MISSING}
                      </td>
                      <td className="py-3.5 px-4">
                        {statusText ? <StatusBadge status={statusText} /> : MISSING}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {p.id && (
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-blue-50 text-[#2563EB] border border-blue-200 hover:border-blue-300 font-bold rounded-xl text-xs transition-colors shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          <span>View</span>
                        </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="No medicines found"
                      description={
                        searchTerm || statusFilter !== 'ALL' || categoryFilter !== 'ALL'
                          ? 'No products match the current search or filters.'
                          : 'No products are in the catalog yet.'
                      }
                    />
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
