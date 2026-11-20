'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Package, Plus } from 'lucide-react';
import { getAdminProducts } from '@/app/actions/admin';
import { ProductDialog } from '@/components/products/ProductDialog';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  PageBody,
  PageHeader,
  QueryView,
  SearchInput,
  SegmentedControl,
  Select,
  StatusBadge,
  useToast,
  type Column,
} from '@/components/ui';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatNumber, text } from '@/lib/format';
import type { ApiData } from '@/lib/api/types';

const LEVELS = [
  { id: 'ALL', label: 'All' },
  { id: 'LOW', label: 'Low' },
  { id: 'OUT', label: 'Out of stock' },
  { id: 'INACTIVE', label: 'Inactive' },
];

const columns: Column<ApiData>[] = [
  {
    key: 'name',
    header: 'Medicine',
    cell: (p) => (
      <span>
        {p.name}
        {p.generic_name && <span className="block text-xs font-normal text-subtle">{p.generic_name}</span>}
      </span>
    ),
  },
  { key: 'form', header: 'Form · strength', hideOnMobile: true, cell: (p) => [p.dosage_form, p.strength].filter(Boolean).join(' · ') || '—' },
  { key: 'category', header: 'Category', hideOnMobile: true, cell: (p) => text(p.category) },
  { key: 'barcode', header: 'Barcode', hideOnMobile: true, cell: (p) => <span className="font-mono text-xs">{text(p.barcode)}</span> },
  { key: 'stock', header: 'In stock', align: 'right', cell: (p) => <span className="tabular">{formatNumber(p.stock_quantity)}</span> },
  { key: 'reorder', header: 'Reorder at', align: 'right', hideOnMobile: true, cell: (p) => <span className="tabular">{formatNumber(p.reorder_level)}</span> },
  {
    key: 'level',
    header: 'Status',
    cell: (p) => (p.is_active === false ? <Badge>Inactive</Badge> : <StatusBadge status={p.stock_level} />),
  },
];

function ProductsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [level, setLevel] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [adding, setAdding] = useState(false);
  const products = useApiQuery(() => getAdminProducts(), []);

  const categories = useMemo(
    () => [...new Set((products.data ?? []).map((p: ApiData) => p.category).filter(Boolean) as string[])].sort(),
    [products.data],
  );

  const q = search.trim().toLowerCase();
  const matches = (p: ApiData) =>
    (!q || p.name?.toLowerCase().includes(q) || p.generic_name?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q)) &&
    (category === 'ALL' || p.category === category) &&
    (level === 'ALL' ||
      (level === 'LOW' && (p.stock_level === 'LOW' || p.stock_level === 'CRITICAL')) ||
      (level === 'OUT' && p.stock_level === 'OUT_OF_STOCK') ||
      (level === 'INACTIVE' && p.is_active === false));

  return (
    <PageBody>
      <PageHeader
        title="Medicines"
        description="The catalogue used by medicine search on the label workstation."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
            Add medicine
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={setSearch} label="Search medicines" placeholder="Name, generic name or barcode" />
          <div className="w-full sm:w-52">
            <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="ALL">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <SegmentedControl label="Stock level" options={LEVELS} value={level} onChange={setLevel} className="lg:ml-auto" />
        </div>
        <QueryView
          query={products}
          errorTitle="Could not load medicines"
          isEmpty={(d) => d.length === 0}
          empty={
            <EmptyState
              icon={Package}
              title="No medicines in the catalogue"
              description="Add medicines here; stock is then recorded through Receive stock."
              action={<Button icon={Plus} onClick={() => setAdding(true)}>Add medicine</Button>}
            />
          }
        >
          {(rows) => {
            const shown = rows.filter(matches);
            return shown.length === 0 ? (
              <EmptyState title="No medicines match these filters" />
            ) : (
              <DataTable caption="Medicines" columns={columns} rows={shown} rowKey={(p) => p.id} rowHref={(p) => `/admin/products/${p.id}`} />
            );
          }}
        </QueryView>
        {products.status === 'success' && (
          <p className="border-t border-border px-4 py-3 text-xs text-subtle">
            Status uses each medicine’s own reorder level and minimum. “Not configured” means none has been set; no default is assumed.
          </p>
        )}
      </Card>
      {adding && (
      <ProductDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={(p) => {
          setAdding(false);
          toast.success(`${p.name} was added to the catalogue.`);
          router.push(`/admin/products/${p.id}`);
        }}
      />
      )}
    </PageBody>
  );
}

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsInner />
    </Suspense>
  );
}
