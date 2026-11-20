'use client';

import React, { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { getInventoryMovements } from '@/app/actions/inventory';
import { InventoryHeader } from '@/components/shell/InventoryHeader';
import { Card, DataTable, EmptyState, PageBody, QueryView, SearchInput, Select, StatusBadge, type Column } from '@/components/ui';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatDateTime, formatNumber, toNumberOrNull } from '@/lib/format';
import type { ApiData } from '@/lib/api/types';

const TYPES = [
  ['ALL', 'All movement types'],
  ['DISPENSE', 'Dispensed'],
  ['STOCK_RECEIVED', 'Received'],
  ['ADJUSTMENT_IN', 'Adjustment in'],
  ['ADJUSTMENT_OUT', 'Adjustment out'],
  ['EXPIRED', 'Expired write-off'],
  ['DAMAGED', 'Damaged'],
  ['SUPPLIER_RETURN', 'Returned to supplier'],
  ['RETURNED', 'Returned (legacy)'],
];

const columns: Column<ApiData>[] = [
  { key: 'date', header: 'Date', cell: (m) => formatDateTime(m.created_at) },
  {
    key: 'product',
    header: 'Medicine',
    cell: (m) => (
      <span>
        {m.products?.name ?? 'Unknown medicine'}
        {m.product_batches?.batch_number && <span className="block font-mono text-xs text-subtle">Batch {m.product_batches.batch_number}</span>}
      </span>
    ),
  },
  { key: 'type', header: 'Type', cell: (m) => <StatusBadge status={m.movement_type} /> },
  {
    key: 'qty',
    header: 'Change',
    align: 'right',
    cell: (m) => {
      const q = toNumberOrNull(m.quantity);
      return <span className={`tabular font-medium ${q !== null && q < 0 ? 'text-danger' : 'text-success'}`}>{q === null ? '—' : q > 0 ? `+${q}` : q}</span>;
    },
  },
  {
    key: 'balance',
    header: 'Before → after',
    align: 'right',
    hideOnMobile: true,
    cell: (m) => <span className="tabular text-muted">{formatNumber(m.stock_before)} → {formatNumber(m.stock_after)}</span>,
  },
  {
    key: 'ref',
    header: 'Reference / reason',
    hideOnMobile: true,
    cell: (m) => <span className="line-clamp-2">{m.prescriptions?.prescription_number ?? m.reason ?? '—'}</span>,
  },
];

export default function MovementsPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('ALL');
  const movements = useApiQuery(() => getInventoryMovements(undefined, type), [type]);
  const q = search.trim().toLowerCase();

  return (
    <PageBody>
      <InventoryHeader title="Stock movements" description="The stock ledger: every dispense, receipt and adjustment (500 most recent)." />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} label="Search movements" placeholder="Medicine, batch or RX number" />
          <div className="w-full sm:w-56">
            <Select aria-label="Movement type" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <QueryView
          query={movements}
          errorTitle="Could not load stock movements"
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState icon={ArrowLeftRight} title="No stock movements recorded" />}
        >
          {(rows) => {
            const shown = rows.filter(
              (m: ApiData) =>
                !q ||
                m.products?.name?.toLowerCase().includes(q) ||
                m.product_batches?.batch_number?.toLowerCase().includes(q) ||
                m.prescriptions?.prescription_number?.toLowerCase().includes(q),
            );
            return shown.length === 0 ? (
              <EmptyState title="No movements match your search" />
            ) : (
              <DataTable caption="Stock movements" columns={columns} rows={shown} rowKey={(m) => m.id} rowHref={(m) => (m.product_id ? `/admin/products/${m.product_id}` : null)} />
            );
          }}
        </QueryView>
      </Card>
    </PageBody>
  );
}
