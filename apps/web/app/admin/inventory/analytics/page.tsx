'use client';

import React, { useState } from 'react';
import { getInventoryAnalytics } from '@/app/actions/inventory';
import { InventoryHeader } from '@/components/shell/InventoryHeader';
import { Card, CardHeader, DataTable, EmptyState, PageBody, QueryView, SegmentedControl, type Column } from '@/components/ui';
import { ChartTable, HorizontalBarChart } from '@/components/ui/Charts';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatDate, formatLkr, formatNumber } from '@/lib/format';
import type { ApiData } from '@/lib/api/types';

const RANGES = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
];

const slowColumns: Column<ApiData>[] = [
  { key: 'name', header: 'Medicine', cell: (r) => r.name },
  { key: 'stock', header: 'In stock', align: 'right', cell: (r) => <span className="tabular">{formatNumber(r.stockQty)}</span> },
  { key: 'value', header: 'Value at cost', align: 'right', cell: (r) => (r.stockValue == null ? <span className="text-subtle">No costed batches</span> : <span className="tabular">{formatLkr(r.stockValue)}</span>) },
  { key: 'last', header: 'Last dispensed', align: 'right', hideOnMobile: true, cell: (r) => (r.lastDispensedAt ? `${formatDate(r.lastDispensedAt)} (${r.daysSinceDispensed} d)` : 'Never') },
];

export default function InventoryAnalyticsPage() {
  const [range, setRange] = useState('30d');
  const analytics = useApiQuery(() => getInventoryAnalytics(range), [range]);
  const label = RANGES.find((r) => r.id === range)?.label;

  return (
    <PageBody>
      <InventoryHeader
        title="Stock analytics"
        description="Computed from dispensing records and batch costs."
        actions={<SegmentedControl label="Time range" options={RANGES} value={range} onChange={setRange} />}
      />
      <QueryView query={analytics} errorTitle="Could not load stock analytics">
        {(a) => {
          const fast: ApiData[] = Array.isArray(a.fastMoving) ? a.fastMoving : [];
          const slow: ApiData[] = Array.isArray(a.slowMoving) ? a.slowMoving : [];
          const cats: ApiData[] = Array.isArray(a.stockByCategory) ? a.stockByCategory : [];
          return (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader title="Fastest moving" description={`Units dispensed, last ${label}`} />
                <div className="p-5">
                  {fast.length === 0 ? (
                    <EmptyState title="Nothing dispensed in this period" />
                  ) : (
                    <>
                      <HorizontalBarChart data={fast.map((f) => ({ name: f.name, value: f.dispensedQty }))} valueName="Units dispensed" />
                      <ChartTable caption="Units dispensed by medicine" columns={['Medicine', 'Category', 'Units']} rows={fast.map((f) => [f.name, f.category ?? '—', f.dispensedQty])} />
                    </>
                  )}
                </div>
              </Card>
              <Card>
                <CardHeader title="Stock value by category" description="Batches with stock, at purchase cost" />
                <div className="p-5">
                  {cats.length === 0 ? (
                    <EmptyState title="No costed batches in stock" description="Values come from the unit cost recorded when stock is received." />
                  ) : (
                    <>
                      <HorizontalBarChart data={cats.map((c) => ({ name: c.category, value: Math.round(c.value) }))} valueName="Value at cost (LKR)" />
                      <ChartTable
                        caption="Stock value by category"
                        columns={['Category', 'Value (LKR)', 'Share %']}
                        rows={cats.map((c) => [c.category, Math.round(c.value), c.percentage])}
                      />
                    </>
                  )}
                </div>
              </Card>
              <Card className="xl:col-span-2">
                <CardHeader title="Not dispensed in this period" description={`Medicines with stock and no dispensing in the last ${label}, highest value first`} />
                {slow.length === 0 ? (
                  <EmptyState title="Every stocked medicine was dispensed in this period" />
                ) : (
                  <DataTable caption="Slow-moving medicines" columns={slowColumns} rows={slow} rowKey={(r) => r.productId} rowHref={(r) => `/admin/products/${r.productId}`} />
                )}
              </Card>
            </div>
          );
        }}
      </QueryView>
    </PageBody>
  );
}
