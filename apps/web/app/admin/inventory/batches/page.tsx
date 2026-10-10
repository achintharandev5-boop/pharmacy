'use client';

import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { getInventoryBatches } from '@/app/actions/inventory';
import { InventoryHeader } from '@/components/shell/InventoryHeader';
import { Card, DataTable, EmptyState, PageBody, QueryView, SearchInput, SegmentedControl, StatusBadge, type Column } from '@/components/ui';
import { useApiQuery } from '@/lib/useApiQuery';
import { daysUntil, formatDate, formatLkr, formatNumber, text } from '@/lib/format';
import type { ApiData } from '@/lib/api/types';

const STATUSES = [
  { id: 'ALL', label: 'All' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'EXPIRED', label: 'Expired' },
  { id: 'DEPLETED', label: 'Depleted' },
  { id: 'QUARANTINED', label: 'Quarantined' },
];

const columns: Column<ApiData>[] = [
  {
    key: 'product',
    header: 'Medicine',
    cell: (b) => (
      <span>
        {b.products?.name ?? 'Unknown medicine'}
        <span className="block font-mono text-xs font-normal text-subtle">Batch {b.batch_number}</span>
      </span>
    ),
  },
  {
    key: 'expiry',
    header: 'Expiry',
    cell: (b) => {
      const d = daysUntil(b.expiry_date);
      return (
        <span className="flex flex-col">
          <span>{b.expiry_date ? formatDate(b.expiry_date) : 'Not recorded'}</span>
          {d !== null && d < 0 && <span className="text-xs font-medium text-danger">Expired {-d} day(s) ago</span>}
          {d !== null && d >= 0 && d <= 30 && <span className="text-xs font-medium text-warning">{d} day(s) left</span>}
        </span>
      );
    },
  },
  { key: 'available', header: 'Available', align: 'right', cell: (b) => <span className="tabular">{formatNumber(b.quantity_available)}</span> },
  { key: 'received', header: 'Received', align: 'right', hideOnMobile: true, cell: (b) => <span className="tabular">{formatNumber(b.quantity_received)}</span> },
  { key: 'cost', header: 'Unit cost', align: 'right', hideOnMobile: true, cell: (b) => <span className="tabular">{formatLkr(b.purchase_cost)}</span> },
  { key: 'supplier', header: 'Supplier', hideOnMobile: true, cell: (b) => text(b.suppliers?.name) },
  { key: 'status', header: 'Status', cell: (b) => <StatusBadge status={b.status} /> },
];

export default function BatchesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const batches = useApiQuery(() => getInventoryBatches(undefined, status), [status]);
  const q = search.trim().toLowerCase();

  return (
    <PageBody>
      <InventoryHeader title="Batches" description="Each received batch, earliest expiry first." />
      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <SearchInput value={search} onChange={setSearch} label="Search batches" placeholder="Medicine, batch number or barcode" />
          <SegmentedControl label="Batch status" options={STATUSES} value={status} onChange={setStatus} />
        </div>
        <QueryView
          query={batches}
          errorTitle="Could not load batches"
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState icon={Layers} title={status === 'ALL' ? 'No batches recorded' : 'No batches with this status'} description="Batches are created by Receive stock." />}
        >
          {(rows) => {
            const shown = rows.filter(
              (b: ApiData) =>
                !q || b.batch_number?.toLowerCase().includes(q) || b.products?.name?.toLowerCase().includes(q) || b.products?.barcode?.toLowerCase().includes(q),
            );
            return shown.length === 0 ? (
              <EmptyState title="No batches match your search" />
            ) : (
              <DataTable caption="Batches" columns={columns} rows={shown} rowKey={(b) => b.id} rowHref={(b) => (b.product_id ? `/admin/products/${b.product_id}` : null)} />
            );
          }}
        </QueryView>
      </Card>
    </PageBody>
  );
}
