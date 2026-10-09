'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Package, Search, Eye } from 'lucide-react';
import { getAdminProducts } from '@/app/actions/admin';
import PageHeader from '@/components/admin/PageHeader';
import FilterTabs from '@/components/admin/FilterTabs';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import { ErrorState, LoadingState, MISSING } from '@/components/admin/DataState';
import { useApiQuery } from '@/lib/useApiQuery';

export default function MasterProductsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('ALL');
  const productsQuery = useApiQuery(
    () => getAdminProducts(searchTerm, undefined, stockFilter === 'ALL' ? undefined : stockFilter.toLowerCase()),
    [searchTerm, stockFilter],
  );
  const products = productsQuery.data ?? [];

  const filteredProducts = products.filter((p) => {
    if (stockFilter === 'Expiring Soon') {
      if (!p.expiry_date) return false;
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      return p.expiry_date <= thirtyDaysFromNow;
    }
    return true;
  });

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {/* HEADER */}
      <PageHeader
        title="Products"
        subtitle="Manage medicines, brands, barcodes, pricing and stock availability."
        icon={Package}
        actions={[
          {
            label: '+ Add Product',
            variant: 'primary',
            disabled: true,
            disabledReason: 'Adding medicines is not available yet: the API has no endpoint to save new products.',
          },
        ]}
      />

      {/* SEARCH & FILTERS BAR */}
      <div className="bg-white/88 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search product, brand, generic name or barcode..."
            className="w-full h-[40px] pl-10 pr-4 bg-[#F8FBFF] border border-slate-200 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 rounded-xl text-xs font-semibold outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        <FilterTabs
          tabs={['ALL', 'In Stock', 'Low Stock', 'Out of Stock', 'Expiring Soon']}
          activeTab={stockFilter}
          onChange={(tab) => setStockFilter(tab)}
        />
      </div>

      {/* PRODUCTS TABLE */}
      <div className="bg-white/96 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Product</th>
                <th className="py-3.5 px-4">Brand / Generic</th>
                <th className="py-3.5 px-4">Barcode</th>
                <th className="py-3.5 px-4 text-center">Stock</th>
                <th className="py-3.5 px-4">Unit Price</th>
                <th className="py-3.5 px-4">Expiry</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {productsQuery.status === 'loading' ? (
                <tr>
                  <td colSpan={8}>
                    <LoadingState label="Loading products…" />
                  </td>
                </tr>
              ) : productsQuery.status === 'error' ? (
                <tr>
                  <td colSpan={8}>
                    <ErrorState title="Could not load products" message={productsQuery.error} onRetry={productsQuery.retry} />
                  </td>
                </tr>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((p) => {
                  const stock = typeof p.stock_quantity === 'number' ? p.stock_quantity : null;
                  const reorderLevel = typeof p.reorder_level === 'number' ? p.reorder_level : null;
                  const price = p.unit_price ?? p.retail_price;
                  const isExpiring =
                    p.expiry_date &&
                    p.expiry_date <=
                      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                  // Status is only shown when it can be derived from recorded values.
                  let statusText: string | null = null;
                  if (stock !== null) {
                    if (stock <= 0) statusText = 'Out of Stock';
                    else if (reorderLevel !== null && stock <= reorderLevel) statusText = 'Low Stock';
                    else if (isExpiring) statusText = 'Expiring';
                    else statusText = 'In Stock';
                  }

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <span className="text-[13px] font-bold text-[#0F172A] block leading-tight">
                          {p.name || MISSING}
                        </span>
                        {p.category && (
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                            {p.category}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-semibold">
                        {p.brand_name || p.generic_name || MISSING}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500">
                        {p.barcode || MISSING}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-center text-slate-800">
                        {stock ?? MISSING}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {price !== undefined && price !== null && Number.isFinite(Number(price))
                          ? `LKR ${Number(price).toFixed(2)}`
                          : MISSING}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                        {p.expiry_date || MISSING}
                      </td>
                      <td className="py-3.5 px-4">
                        {statusText ? <StatusBadge status={statusText} /> : MISSING}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {p.id && (
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 text-[#2563EB] border border-blue-200 hover:border-blue-300 font-bold rounded-xl text-xs transition-colors shadow-2xs group/btn"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400 group-hover/btn:text-[#2563EB]" />
                          <span>View Details</span>
                        </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      title="No products found"
                      description={
                        searchTerm || stockFilter !== 'ALL'
                          ? 'No products match the current search or filter.'
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
