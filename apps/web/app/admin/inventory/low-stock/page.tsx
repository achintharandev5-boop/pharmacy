'use client';

import React from 'react';
import { PackageCheck, PackagePlus } from 'lucide-react';
import { getInventoryLowStock } from '@/app/actions/inventory';
import { InventoryHeader } from '@/components/shell/InventoryHeader';
import { Card, DataTable, EmptyState, LinkButton, PageBody, QueryView, StatusBadge, type Column } from '@/components/ui';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatNumber } from '@/lib/format';
import type { ApiData } from '@/lib/api/types';

const columns: Column<ApiData>[] = [
  { key: 'name', header: 'Medicine', cell: (p) => p.name },
  { key: 'stock', header: 'In stock', align: 'right', cell: (p) => <span className="tabular font-medium">{formatNumber(p.stock_quantity)}</span> },
  { key: 'min', header: 'Minimum', align: 'right', hideOnMobile: true, cell: (p) => <span className="tabular">{formatNumber(p.minimum_stock)}</span> },
  { key: 'reorder', header: 'Reorder level', align: 'right', cell: (p) => <span className="tabular">{formatNumber(p.reorder_level)}</span> },
  {
    key: 'suggested',
    header: 'Suggested order',
    align: 'right',
    hideOnMobile: true,
    cell: (p) => (p.suggestedOrderQty == null ? <span className="text-subtle">Set a maximum</span> : <span className="tabular">{formatNumber(p.suggestedOrderQty)}</span>),
  },
  { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
];

export default function LowStockPage() {
  const low = useApiQuery(() => getInventoryLowStock(), []);
  return (
    <PageBody>
      <InventoryHeader
        title="Low stock"
        description="Active medicines at or below their own reorder level. Medicines without a reorder level are not listed."
        actions={
          <LinkButton href="/admin/inventory/receiving" variant="primary" icon={PackagePlus}>
            Receive stock
          </LinkButton>
        }
      />
      <Card>
        <QueryView
          query={low}
          errorTitle="Could not load low stock"
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState icon={PackageCheck} title="Nothing is below its reorder level" description="Set reorder levels on medicines to have them checked here." />}
        >
          {(rows) => <DataTable caption="Medicines needing reorder" columns={columns} rows={rows} rowKey={(p) => p.id} rowHref={(p) => `/admin/products/${p.id}`} />}
        </QueryView>
        {low.status === 'success' && low.data.length > 0 && (
          <p className="border-t border-border px-4 py-3 text-xs text-subtle">Suggested order = maximum stock minus current stock, shown only when a maximum is set.</p>
        )}
      </Card>
    </PageBody>
  );
}
