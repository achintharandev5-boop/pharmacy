'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Package,
  Search,
  Plus,
  ArrowRight,
  Barcode,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import { getAdminProducts } from '@/app/actions/admin';
import PageHeader from '@/components/admin/PageHeader';
import FilterTabs from '@/components/admin/FilterTabs';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';

export default function MasterProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      try {
        const data = await getAdminProducts(
          searchTerm,
          undefined,
          stockFilter === 'ALL' ? undefined : stockFilter.toLowerCase()
        );
        if (Array.isArray(data)) {
          setProducts(data);
        }
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [searchTerm, stockFilter]);

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
            href: '/admin/inventory/products',
            variant: 'primary',
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
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-semibold">
                    <div className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading product catalog...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((p) => {
                  const stock = Number(p.stock_quantity || 0);
                  const isOut = stock <= 0;
                  const isLow = stock > 0 && stock <= 15;
                  const isExpiring =
                    p.expiry_date &&
                    p.expiry_date <=
                      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                  let statusText = 'In Stock';
                  if (isOut) statusText = 'Out of Stock';
                  else if (isLow) statusText = 'Low Stock';
                  else if (isExpiring) statusText = 'Expiring';

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <span className="text-[13px] font-bold text-[#0F172A] block leading-tight">
                          {p.name}
                        </span>
                        {p.category && (
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                            {p.category}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-semibold">
                        {p.brand_name || 'Generic'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500">
                        {p.barcode || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-center text-slate-800">
                        {stock}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        LKR {Number(p.unit_price || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                        {p.expiry_date || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={statusText} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/admin/products/${p.id || 'prod_1'}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 text-[#2563EB] border border-blue-200 hover:border-blue-300 font-bold rounded-xl text-xs transition-colors shadow-2xs group/btn"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400 group-hover/btn:text-[#2563EB]" />
                          <span>View Details</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      title="No products found"
                      description={`No medicines found matching "${searchTerm}". You can add new stock to the catalog.`}
                      actionText="+ Add Product"
                      actionHref="/admin/inventory/products"
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
