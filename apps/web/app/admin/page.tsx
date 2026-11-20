'use client';

import { uiTestEnabled } from '@/lib/uiTestMode';
import React, { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Boxes, FilePlus2, FileText, Package, PackagePlus, Pill, UserPlus, Users, Warehouse, type LucideIcon } from 'lucide-react';
import { getAdminActivity, getAdminSummary, getAdminTopProducts } from '@/app/actions/admin';
import { getPrescriptionHistory } from '@/app/actions/prescriptions';
import { getDashboardExpiryBatches, getDashboardMovementActivity, getInventoryLowStock, getInventorySummary } from '@/app/actions/inventory';
import {
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  LinkButton,
  PageBody,
  PageHeader,
  QueryView,
  RefreshButton,
  SegmentedControl,
  StatTile,
  StatusBadge,
  type Column,
} from '@/components/ui';
import { ChartTable, ColumnChart, DailyLineChart, HorizontalBarChart } from '@/components/ui/Charts';
import { useApiQuery } from '@/lib/useApiQuery';
import { daysUntil, formatDate, formatDateTime, formatNumber, isNumber } from '@/lib/format';
import type { ApiData } from '@/lib/api/types';

const RANGES = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
];

function dayLabel(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

const prescriptionColumns: Column<ApiData>[] = [
  { key: 'number', header: 'Prescription', cell: (r) => <span className="font-mono">{r.prescription_number}</span> },
  { key: 'patient', header: 'Patient', cell: (r) => r.customer_name_text || 'Walk-in patient' },
  { key: 'created', header: 'Created', hideOnMobile: true, cell: (r) => formatDateTime(r.created_at) },
  { key: 'status', header: 'Status', align: 'right', cell: (r) => <StatusBadge status={r.status} /> },
];

const expiryColumns: Column<ApiData>[] = [
  { key: 'medicine', header: 'Medicine', cell: (r) => r.products?.name ?? 'Unknown medicine' },
  { key: 'batch', header: 'Batch', hideOnMobile: true, cell: (r) => <span className="font-mono">{r.batch_number}</span> },
  {
    key: 'expiry',
    header: 'Expiry',
    cell: (r) => {
      const remaining = daysUntil(r.expiry_date);
      return (
        <span className="flex flex-col">
          <span>{formatDate(r.expiry_date)}</span>
          {remaining !== null && <span className={`text-xs ${remaining < 0 ? 'text-danger' : 'text-warning'}`}>{remaining < 0 ? `${-remaining} day(s) overdue` : `in ${remaining} day(s)`}</span>}
        </span>
      );
    },
  },
  { key: 'quantity', header: 'Units left', align: 'right', cell: (r) => <span className="tabular">{formatNumber(r.quantity_available)}</span> },
];

/** Shortcuts to existing workflows only; each opens the real page or dialog. */
const QUICK_ACTIONS: { href: string; title: string; description: string; icon: LucideIcon }[] = [
  { href: '/label', title: 'New prescription label', description: 'Open the label workstation', icon: FilePlus2 },
  { href: '/admin/patients?new=1', title: 'Add patient', description: 'Register a patient record', icon: UserPlus },
  { href: '/admin/products?new=1', title: 'Add medicine', description: 'Add to the medicine catalogue', icon: Pill },
  { href: '/admin/inventory/receiving', title: 'Receive stock', description: 'Record a supplier delivery', icon: PackagePlus },
  { href: '/admin/inventory', title: 'View inventory', description: 'Stock, batches and expiry', icon: Warehouse },
];

/** Stock status colours carry meaning: healthy, low, critical, out, not configured. */
const STOCK_COLORS: Record<string, string> = {
  Healthy: 'var(--color-chart-2)',
  Low: 'var(--color-chart-4)',
  Critical: 'var(--color-chart-danger)',
  'Out of stock': 'var(--color-danger)',
  'No threshold': 'var(--color-chart-5)',
};

function todayLabel() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function DashboardPage() {
  const [range, setRange] = useState('7d');
  const summary = useApiQuery(() => getAdminSummary(), []);
  const inventory = useApiQuery(() => getInventorySummary(), []);
  const activity = useApiQuery(() => getAdminActivity(range), [range]);
  const movements = useApiQuery(() => getDashboardMovementActivity(range), [range]);
  const top = useApiQuery(() => getAdminTopProducts(range, 6), [range]);
  const recent = useApiQuery(() => getPrescriptionHistory(), []);
  const lowStock = useApiQuery(() => getInventoryLowStock(6), []);
  const expiries = useApiQuery(() => getDashboardExpiryBatches(6), []);

  const s = summary.status === 'success' ? summary.data : undefined;
  const inv = inventory.status === 'success' ? inventory.data : undefined;
  const inventoryError = inventory.status === 'error' ? inventory.error : null;
  const summaryError = summary.status === 'error' ? summary.error : null;
  const inventoryLoading = inventory.status === 'loading';
  const summaryLoading = summary.status === 'loading';
  const lowCount = isNumber(s?.inventory?.lowStock) ? s.inventory.lowStock : null;
  const rangeLabel = RANGES.find((item) => item.id === range)?.label ?? '7 days';

  return (
    <PageBody>
      <PageHeader
        title={uiTestEnabled() ? "Welcome, UI Tester" : "Dashboard"}
        description={
          uiTestEnabled() ? (
            'Explore and test the pharmacy interface without a database connection.'
          ) : (
            <>
              <span suppressHydrationWarning>{todayLabel()}</span>
              {s?.asOf ? ` · updated ${formatDateTime(s.asOf)}` : ' · pharmacy operations at a glance'}
            </>
          )
        }
        actions={<LinkButton href="/label" variant="primary" icon={FilePlus2}>{uiTestEnabled() ? "Create Test Label" : "New prescription label"}</LinkButton>}
      />

      <section aria-label="Pharmacy summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatTile label="Total medicines" icon={Pill} value={inv?.totalProducts} hint="Medicine catalogue" loading={inventoryLoading} error={inventoryError} href="/admin/products" />
        <StatTile label="Low-stock medicines" icon={Package} value={lowCount} hint="Active medicines at or below their reorder level" loading={summaryLoading} error={summaryError} tone={lowCount ? 'warning' : 'neutral'} href="/admin/inventory/low-stock" />
        <StatTile label="Batches expiring ≤ 30 days" icon={AlertTriangle} value={inv?.expiry?.within30Days} hint={isNumber(inv?.expiry?.expired) && inv.expiry.expired > 0 ? `${inv.expiry.expired} expired batch(es) also need review` : 'Stocked batches only'} loading={inventoryLoading} error={inventoryError} tone={inv?.expiry?.within30Days ? 'warning' : 'neutral'} href="/admin/inventory/expiry" />
        <StatTile label="Total patients" icon={Users} value={s?.totalPatients} hint="Registered patient records" loading={summaryLoading} error={summaryError} href="/admin/patients" />
        <StatTile label="Prescriptions today" icon={FileText} value={s?.today?.prescriptions} hint={s?.timeZone ? `Today · ${s.timeZone}` : 'Saved prescriptions'} loading={summaryLoading} error={summaryError} href="/admin/prescriptions" />
        <StatTile label="Inventory movements today" icon={Boxes} value={s?.today?.inventoryMovements} hint="Recorded ledger entries" loading={summaryLoading} error={summaryError} href="/admin/inventory/movements" />
      </section>

      {summaryError && <Card><QueryView query={summary} errorTitle="Could not load pharmacy totals">{() => null}</QueryView></Card>}

      <section aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title" className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-subtle">Quick actions</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {QUICK_ACTIONS.map(({ href, title, description, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex h-full items-center gap-3.5 rounded-ui-lg border border-border bg-page p-4 shadow-card transition-[border-color,box-shadow] hover:border-primary-border hover:shadow-pop"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ui bg-[var(--color-tint)] text-primary transition-colors group-hover:bg-primary-solid group-hover:text-[var(--color-on-primary-solid)]" aria-hidden="true">
                  <Icon size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-fg">{title}</span>
                  <span className="block truncate text-xs text-subtle">{description}</span>
                </span>
                <ArrowRight size={16} className="shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Prescription activity" description={`Saved prescriptions and printed labels · ${rangeLabel}`} actions={<div className="flex items-center gap-1"><SegmentedControl label="Activity date range" options={RANGES} value={range} onChange={setRange} /><RefreshButton onClick={activity.retry} busy={activity.isFetching} /></div>} />
          <div className="p-4 sm:p-5">
            <QueryView query={activity} errorTitle="Could not load prescription activity" isEmpty={(rows) => rows.length === 0}>
              {(rows) => {
                const data = rows.map((row: ApiData) => ({ date: row.date, prescriptions: row.prescriptions, labels: row.labels }));
                const total = data.reduce((sum: number, row: ApiData) => sum + (isNumber(row.prescriptions) ? row.prescriptions : 0), 0);
                return <><DailyLineChart data={data} formatDay={dayLabel} series={[{ key: 'prescriptions', name: 'Prescriptions' }, { key: 'labels', name: 'Labels printed' }]} height={230} />{total === 0 && <p className="text-center text-xs text-subtle">No prescriptions recorded in this period.</p>}<ChartTable caption="Prescription activity by day" columns={['Date', 'Prescriptions', 'Labels printed']} rows={rows.map((row: ApiData) => [dayLabel(row.date), row.prescriptions, row.labels])} /></>;
              }}
            </QueryView>
          </div>
        </Card>

        <Card>
          <CardHeader title="Inventory movement trend" description={`Ledger entries by day · ${rangeLabel}`} actions={<RefreshButton onClick={movements.retry} busy={movements.isFetching} />} />
          <div className="p-4 sm:p-5">
            <QueryView query={movements} errorTitle="Could not load inventory movement activity" isEmpty={(rows) => rows.length === 0}>
              {(rows) => {
                const data = rows.map((row: ApiData) => ({ date: row.date, movements: row.movements }));
                const total = data.reduce((sum: number, row: ApiData) => sum + (isNumber(row.movements) ? row.movements : 0), 0);
                return <><DailyLineChart data={data} formatDay={dayLabel} series={[{ key: 'movements', name: 'Inventory movements' }]} height={230} />{total === 0 && <p className="text-center text-xs text-subtle">No inventory ledger entries recorded in this period.</p>}<ChartTable caption="Inventory movement count by day" columns={['Date', 'Movements']} rows={rows.map((row: ApiData) => [dayLabel(row.date), row.movements])} /></>;
              }}
            </QueryView>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Medicine stock status" description="Catalogue products grouped by recorded stock level" actions={<RefreshButton onClick={inventory.retry} busy={inventory.isFetching} />} />
          <div className="p-4 sm:p-5">
            <QueryView query={inventory} errorTitle="Could not load stock status">
              {(data) => {
                const chart = [
                  { name: 'Healthy', value: data.stock?.healthy },
                  { name: 'Low', value: data.stock?.low },
                  { name: 'Critical', value: data.stock?.critical },
                  { name: 'Out of stock', value: data.stock?.outOfStock },
                  { name: 'No threshold', value: data.stock?.unclassified },
                ].filter((entry): entry is { name: string; value: number } => isNumber(entry.value));
                return chart.length ? <><ColumnChart data={chart} valueName="Medicines" height={210} colors={chart.map((entry) => STOCK_COLORS[entry.name])} /><ChartTable caption="Medicine stock status" columns={['Stock status', 'Medicines']} rows={chart.map(({ name, value }) => [name, value])} /></> : <EmptyState icon={Pill} title="Stock status unavailable" />;
              }}
            </QueryView>
          </div>
        </Card>

        <Card>
          <CardHeader title="Most dispensed medicines" description={`Recorded dispensed units · ${rangeLabel}`} actions={<RefreshButton onClick={top.retry} busy={top.isFetching} />} />
          <div className="p-4 sm:p-5">
            <QueryView query={top} errorTitle="Could not load dispensing totals" isEmpty={(rows) => rows.length === 0} empty={<EmptyState icon={Package} title="Nothing dispensed in this period" />}>
              {(rows) => {
                const data = rows.filter((row: ApiData) => isNumber(row.dispensed)).map((row: ApiData) => ({ name: row.name, value: row.dispensed }));
                return data.length ? <><HorizontalBarChart data={data} valueName="Units dispensed" height={Math.max(180, data.length * 34 + 24)} /><ChartTable caption="Units dispensed by medicine" columns={['Medicine', 'Units']} rows={data.map((row) => [row.name, row.value])} /></> : <EmptyState title="No dispensing totals available" />;
              }}
            </QueryView>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Recent prescriptions" description="Latest saved prescriptions" actions={<div className="flex items-center gap-2"><RefreshButton onClick={recent.retry} busy={recent.isFetching} /><Link href="/admin/prescriptions" className="inline-flex h-9 items-center gap-1 text-sm font-medium text-primary hover:underline">All prescriptions <ArrowRight size={14} aria-hidden="true" /></Link></div>} />
          <QueryView query={recent} errorTitle="Could not load recent prescriptions" isEmpty={(rows) => rows.length === 0} empty={<EmptyState icon={FileText} title="No prescriptions yet" description="Saved prescriptions appear here." />}>
            {(rows) => <DataTable caption="Recent prescriptions" columns={prescriptionColumns} rows={rows.slice(0, 6)} rowKey={(row) => row.id} rowHref={(row) => `/admin/prescriptions/${row.id}`} />}
          </QueryView>
        </Card>

        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Low-stock alerts" description="Medicines at or below their reorder level" actions={<div className="flex items-center gap-2"><RefreshButton onClick={lowStock.retry} busy={lowStock.isFetching} /><Link href="/admin/inventory/low-stock" className="text-sm font-medium text-primary hover:underline">View all</Link></div>} />
            <QueryView query={lowStock} errorTitle="Could not load low-stock medicines" isEmpty={(rows) => rows.length === 0} empty={<EmptyState icon={Package} title="No low-stock medicines" />}>
              {(rows) => <ul className="divide-y divide-border">{rows.slice(0, 6).map((row: ApiData) => <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3"><Link href={`/admin/products/${row.id}`} className="min-w-0 truncate text-sm font-medium text-fg hover:text-primary">{row.name}</Link><span className="flex shrink-0 items-center gap-2"><span className="text-sm tabular text-muted">{formatNumber(row.stock_quantity)} left</span><StatusBadge status={row.status} /></span></li>)}</ul>}
            </QueryView>
          </Card>

          <Card>
            <CardHeader title="Expiry alerts" description="Stocked batches already expired or expiring within 30 days" actions={<Link href="/admin/inventory/expiry" className="text-sm font-medium text-primary hover:underline">Review batches</Link>} />
            <QueryView query={expiries} errorTitle="Could not load expiring batches" isEmpty={(rows) => rows.length === 0} empty={<EmptyState icon={AlertTriangle} title="No expiry alerts" />}>
              {(rows) => <DataTable caption="Expired or soon-to-expire medicine batches" columns={expiryColumns} rows={rows} rowKey={(row) => row.id} rowHref={() => '/admin/inventory/expiry'} />}
            </QueryView>
          </Card>
        </div>
      </div>

      <p className="sr-only" role="status">{uiTestEnabled() ? 'UI testing mode: No backend data has been loaded.' : 'Dashboard data reflects confirmed API results.'} {s?.asOf ? `Last refreshed ${formatDateTime(s.asOf)}.` : ''}</p>
    </PageBody>
  );
}
