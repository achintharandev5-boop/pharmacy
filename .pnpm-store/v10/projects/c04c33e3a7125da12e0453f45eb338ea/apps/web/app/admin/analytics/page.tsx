'use client';

import React, { useState } from 'react';
import { getAdminActivity, getAdminStatusBreakdown, getAdminTopProducts } from '@/app/actions/admin';
import { Card, CardHeader, EmptyState, PageBody, PageHeader, QueryView, SegmentedControl, StatTile, StatusBadge } from '@/components/ui';
import { ChartTable, ColumnChart, DailyLineChart, HorizontalBarChart } from '@/components/ui/Charts';
import { useApiQuery } from '@/lib/useApiQuery';
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

const sum = (rows: ApiData[], key: string) => rows.reduce((n, r) => n + (typeof r[key] === 'number' ? r[key] : 0), 0);

export default function AnalyticsPage() {
  const [range, setRange] = useState('30d');
  const activity = useApiQuery(() => getAdminActivity(range), [range]);
  const breakdown = useApiQuery(() => getAdminStatusBreakdown(range), [range]);
  const top = useApiQuery(() => getAdminTopProducts(range, 10), [range]);
  const label = RANGES.find((r) => r.id === range)?.label;
  const rows: ApiData[] = activity.data ?? [];
  const err = activity.status === 'error' ? activity.error : null;
  const loading = activity.status === 'loading';

  return (
    <PageBody>
      <PageHeader
        title="Analytics"
        description="Dispensing figures computed from saved prescriptions and print records, by day in pharmacy time."
        actions={<SegmentedControl label="Time range" options={RANGES} value={range} onChange={setRange} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label={`Prescriptions · ${label}`} value={loading || err ? null : sum(rows, 'prescriptions')} loading={loading} error={err} />
        <StatTile label={`Labels printed · ${label}`} value={loading || err ? null : sum(rows, 'labels')} loading={loading} error={err} />
        <StatTile label={`Units dispensed · ${label}`} value={loading || err ? null : sum(rows, 'items')} loading={loading} error={err} />
      </div>

      <Card>
        <CardHeader title="Prescriptions and labels per day" />
        <div className="p-5">
          <QueryView query={activity} errorTitle="Could not load activity">
            {(data) => (
              <>
                <DailyLineChart
                  data={data}
                  formatDay={dayLabel}
                  series={[
                    { key: 'prescriptions', name: 'Prescriptions' },
                    { key: 'labels', name: 'Labels printed' },
                  ]}
                />
                <ChartTable
                  caption="Prescriptions, labels and units per day"
                  columns={['Date', 'Prescriptions', 'Labels printed', 'Units dispensed']}
                  rows={data.map((r: ApiData) => [dayLabel(r.date), r.prescriptions, r.labels, r.items])}
                />
              </>
            )}
          </QueryView>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Units dispensed per day" description="Shown separately: a different scale from prescription counts" />
          <div className="p-5">
            <QueryView query={activity} errorTitle="Could not load activity">
              {(data) => <ColumnChart data={data.map((r: ApiData) => ({ name: dayLabel(r.date), value: r.items }))} valueName="Units dispensed" />}
            </QueryView>
          </div>
        </Card>
        <Card>
          <CardHeader title="Prescriptions by time of day" />
          <div className="p-5">
            <QueryView query={breakdown} errorTitle="Could not load breakdown">
              {(b) =>
                !b.total ? (
                  <EmptyState title="No prescriptions in this period" />
                ) : (
                  <>
                    <ColumnChart data={(b.timeOfDay ?? []).map((t: ApiData) => ({ name: t.period.replace(/\s*\(.*\)/, ''), value: t.count }))} valueName="Prescriptions" />
                    <ChartTable caption="Prescriptions by time of day" columns={['Period', 'Prescriptions']} rows={(b.timeOfDay ?? []).map((t: ApiData) => [t.period, t.count])} />
                  </>
                )
              }
            </QueryView>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Most dispensed medicines" description="Units dispensed" />
          <div className="p-5">
            <QueryView query={top} errorTitle="Could not load dispensing totals" isEmpty={(d) => d.length === 0} empty={<EmptyState title="Nothing dispensed in this period" />}>
              {(d) => (
                <>
                  <HorizontalBarChart data={d.map((p: ApiData) => ({ name: p.name, value: p.dispensed }))} valueName="Units dispensed" />
                  <ChartTable caption="Units dispensed by medicine" columns={['Medicine', 'Units']} rows={d.map((p: ApiData) => [p.name, p.dispensed])} />
                </>
              )}
            </QueryView>
          </div>
        </Card>
        <Card className="self-start">
          <CardHeader title="Prescription status" />
          <QueryView query={breakdown} errorTitle="Could not load status breakdown">
            {(b) =>
              !b.total ? (
                <EmptyState title="No prescriptions in this period" />
              ) : (
                <ul className="divide-y divide-border">
                  {(b.status ?? []).map((s: ApiData) => (
                    <li key={s.name} className="flex items-center justify-between px-5 py-3">
                      <StatusBadge status={s.name} />
                      <span className="text-sm font-semibold tabular">{s.value.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )
            }
          </QueryView>
        </Card>
      </div>
    </PageBody>
  );
}
