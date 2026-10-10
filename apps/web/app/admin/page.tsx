'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, FilePlus2, FileText, Package, PackageX, Printer, Users } from 'lucide-react';
import { getAdminActivity, getAdminSummary, getAdminTopProducts } from '@/app/actions/admin';
import { getPrescriptionHistory } from '@/app/actions/prescriptions';
import { getInventoryLowStock, getInventorySummary } from '@/app/actions/inventory';
import {
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  PageBody,
  PageHeader,
  QueryView,
  SegmentedControl,
  StatTile,
  StatusBadge,
} from '@/components/ui';
import { ChartTable, DailyLineChart, HorizontalBarChart } from '@/components/ui/Charts';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatDateTime, formatNumber, isNumber } from '@/lib/format';
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

/** "+3 vs yesterday" from two real figures; nothing when either is unknown. */
function versusYesterday(today: unknown, yesterday: unknown) {
  if (!isNumber(today) || !isNumber(yesterday)) return undefined;
  const diff = today - yesterday;
  return diff === 0 ? 'Same as yesterday' : `${diff > 0 ? '+' : ''}${diff.toLocaleString()} vs yesterday (${yesterday.toLocaleString()})`;
}

export default function DashboardPage() {
  const [range, setRange] = useState('7d');
  const summary = useApiQuery(() => getAdminSummary(), []);
  const inventory = useApiQuery(() => getInventorySummary(), []);
  const activity = useApiQuery(() => getAdminActivity(range), [range]);
  const top = useApiQuery(() => getAdminTopProducts(range, 6), [range]);
  const recent = useApiQuery(() => getPrescriptionHistory(), []);
  const lowStock = useApiQuery(() => getInventoryLowStock(), []);

  const s = summary.data;
  const summaryError = summary.status === 'error' ? summary.error : null;
  const loading = summary.status === 'loading';

  return (
    <PageBody>
      <PageHeader
        title="Dashboard"
        description={s?.asOf ? `Today in pharmacy time · updated ${formatDateTime(s.asOf)}` : 'Today’s dispensing and stock at a glance.'}
        actions={
          <LinkButton href="/label" variant="primary" icon={FilePlus2}>
            New prescription label
          </LinkButton>
        }
      />

      {summaryError && (
        <Card>
          <QueryView query={summary} errorTitle="Could not load today’s figures">
            {() => null}
          </QueryView>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Prescriptions today"
          icon={FileText}
          value={s?.today?.prescriptions}
          hint={versusYesterday(s?.today?.prescriptions, s?.yesterday?.prescriptions)}
          loading={loading}
          error={summaryError}
          href="/admin/prescriptions"
        />
        <StatTile
          label="Labels printed today"
          icon={Printer}
          value={s?.today?.labelsPrinted}
          hint={isNumber(s?.today?.printJobs) ? `${s.today.printJobs} print job(s)` : undefined}
          loading={loading}
          error={summaryError}
          href="/admin/labels"
        />
        <StatTile
          label="Patients today"
          icon={Users}
          value={s?.today?.registeredPatients}
          hint={isNumber(s?.today?.walkInPrescriptions) ? `Registered · plus ${s.today.walkInPrescriptions} walk-in prescription(s)` : undefined}
          loading={loading}
          error={summaryError}
          href="/admin/patients"
        />
        <StatTile
          label="Low or out of stock"
          icon={PackageX}
          value={isNumber(s?.inventory?.lowStock) && isNumber(s?.inventory?.outOfStock) ? s.inventory.lowStock + s.inventory.outOfStock : null}
          hint={
            isNumber(s?.inventory?.noThreshold) && s.inventory.noThreshold > 0
              ? `${s.inventory.noThreshold} product(s) have no reorder level`
              : 'At or below reorder level'
          }
          tone={isNumber(s?.inventory?.outOfStock) && s.inventory.outOfStock > 0 ? 'danger' : 'neutral'}
          loading={loading}
          error={summaryError}
          href="/admin/inventory/low-stock"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Dispensing activity"
            description="Prescriptions saved and labels printed per day"
            actions={<SegmentedControl label="Time range" options={RANGES} value={range} onChange={setRange} />}
          />
          <div className="p-5">
            <QueryView query={activity} errorTitle="Could not load activity" isEmpty={(d) => d.length === 0}>
              {(rows) => {
                const data = rows.map((r: ApiData) => ({ date: r.date, prescriptions: r.prescriptions, labels: r.labels }));
                const total = data.reduce((n: number, r: ApiData) => n + (r.prescriptions ?? 0), 0);
                return (
                  <>
                    {total === 0 && <p className="mb-2 text-sm text-subtle">No prescriptions were saved in this period.</p>}
                    <DailyLineChart
                      data={data}
                      formatDay={dayLabel}
                      series={[
                        { key: 'prescriptions', name: 'Prescriptions' },
                        { key: 'labels', name: 'Labels printed' },
                      ]}
                    />
                    <ChartTable
                      caption="Prescriptions and labels per day"
                      columns={['Date', 'Prescriptions', 'Labels printed', 'Units dispensed']}
                      rows={rows.map((r: ApiData) => [dayLabel(r.date), r.prescriptions, r.labels, r.items])}
                    />
                  </>
                );
              }}
            </QueryView>
          </div>
        </Card>

        <Card>
          <CardHeader title="Stock status" description="Active products by recorded stock level" actions={<Link href="/admin/inventory" className="text-sm font-medium text-primary hover:underline">Inventory</Link>} />
          <QueryView query={inventory} errorTitle="Could not load stock">
            {(inv) => (
              <dl className="divide-y divide-border">
                {[
                  ['Products in catalogue', inv.totalProducts, 'neutral'],
                  ['In stock', inv.stock?.healthy, 'success'],
                  ['Low or critical', isNumber(inv.stock?.low) && isNumber(inv.stock?.critical) ? inv.stock.low + inv.stock.critical : null, 'warning'],
                  ['Out of stock', inv.stock?.outOfStock, 'danger'],
                  ['No reorder level set', inv.stock?.unclassified, 'neutral'],
                  ['Batches expired, still in stock', inv.expiry?.expired, 'danger'],
                  ['Batches expiring ≤ 30 days', inv.expiry?.within30Days, 'warning'],
                ].map(([label, value, tone]) => (
                  <div key={label as string} className="flex items-center justify-between px-5 py-2.5">
                    <dt className="text-sm text-muted">{label as string}</dt>
                    <dd className={`text-sm font-semibold tabular ${tone === 'danger' && Number(value) > 0 ? 'text-danger' : tone === 'warning' && Number(value) > 0 ? 'text-warning' : 'text-fg'}`}>
                      {formatNumber(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </QueryView>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Most dispensed" description={`Units dispensed, last ${RANGES.find((r) => r.id === range)?.label}`} />
          <div className="p-5">
            <QueryView
              query={top}
              errorTitle="Could not load dispensing totals"
              isEmpty={(d) => d.length === 0}
              empty={<EmptyState icon={Package} title="Nothing dispensed in this period" />}
            >
              {(rows) => {
                const data = rows.filter((r: ApiData) => isNumber(r.dispensed)).map((r: ApiData) => ({ name: r.name, value: r.dispensed }));
                return (
                  <>
                    <HorizontalBarChart data={data} valueName="Units dispensed" />
                    <ChartTable caption="Units dispensed by medicine" columns={['Medicine', 'Units']} rows={data.map((d: ApiData) => [d.name, d.value])} />
                  </>
                );
              }}
            </QueryView>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Recent prescriptions" actions={<Link href="/admin/prescriptions" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">All prescriptions <ArrowRight size={14} aria-hidden="true" /></Link>} />
          <QueryView
            query={recent}
            errorTitle="Could not load recent prescriptions"
            isEmpty={(d) => d.length === 0}
            empty={<EmptyState icon={FileText} title="No prescriptions yet" description="Prescriptions saved from the label workstation appear here." />}
          >
            {(rows) => (
              <ul className="divide-y divide-border">
                {rows.slice(0, 6).map((rx: ApiData) => (
                  <li key={rx.id}>
                    <Link href={`/admin/prescriptions/${rx.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-surface">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-fg">{rx.customer_name_text || 'Unnamed patient'}</p>
                        <p className="text-xs text-subtle">
                          <span className="font-mono">{rx.prescription_number}</span> · {Array.isArray(rx.prescription_items) ? rx.prescription_items.length : 0} label(s) · {formatDateTime(rx.created_at)}
                        </p>
                      </div>
                      <StatusBadge status={rx.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </QueryView>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Needs reordering"
          description="Products at or below their own reorder level"
          actions={<Link href="/admin/inventory/low-stock" className="text-sm font-medium text-primary hover:underline">View all</Link>}
        />
        <QueryView
          query={lowStock}
          errorTitle="Could not load low stock"
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState icon={Package} title="Nothing is below its reorder level" description="Products without a reorder level are not checked." />}
        >
          {(rows) => (
            <ul className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
              {rows.slice(0, 6).map((p: ApiData) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link href={`/admin/products/${p.id}`} className="min-w-0 truncate text-sm font-medium text-fg hover:text-primary">
                    {p.name}
                  </Link>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-sm tabular text-muted">{formatNumber(p.stock_quantity)} left</span>
                    <StatusBadge status={p.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </QueryView>
      </Card>

      {s?.inventory && isNumber(s.inventory.expiring30Days) && s.inventory.expiring30Days > 0 && (
        <Link href="/admin/inventory/expiry" className="flex items-center gap-3 rounded-ui-lg border border-warning-border bg-warning-soft px-4 py-3 text-sm text-fg hover:brightness-[0.98]">
          <AlertTriangle size={18} className="text-warning shrink-0" aria-hidden="true" />
          <span className="flex-1">
            <strong>{s.inventory.expiring30Days}</strong> product(s) have stock that is expired or expires within 30 days.
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </PageBody>
  );
}
