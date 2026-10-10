'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarClock, PackagePlus, PackageX, Boxes } from 'lucide-react';
import { getInventoryAlerts, getInventorySummary } from '@/app/actions/inventory';
import { InventoryHeader } from '@/components/shell/InventoryHeader';
import { Badge, Card, CardHeader, EmptyState, LinkButton, PageBody, QueryView, StatTile, type Tone } from '@/components/ui';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatDateTime, formatLkr, formatNumber, isNumber } from '@/lib/format';
import type { ApiData } from '@/lib/api/types';

const SEVERITY: Record<string, { label: string; tone: Tone }> = {
  DANGER: { label: 'Expired', tone: 'danger' },
  CRITICAL: { label: 'Critical', tone: 'danger' },
  HIGH: { label: 'High', tone: 'warning' },
  WARNING: { label: 'Warning', tone: 'warning' },
};

export default function InventoryOverviewPage() {
  const summary = useApiQuery(() => getInventorySummary(), []);
  const alerts = useApiQuery(() => getInventoryAlerts(), []);
  const s = summary.data;
  const err = summary.status === 'error' ? summary.error : null;
  const loading = summary.status === 'loading';

  return (
    <PageBody>
      <InventoryHeader
        title="Inventory"
        description={s?.asOf ? `Stock records as of ${formatDateTime(s.asOf)}` : 'Stock levels, batches and expiry.'}
        breadcrumbs={[{ label: 'Inventory' }]}
        actions={
          <LinkButton href="/admin/inventory/receiving" variant="primary" icon={PackagePlus}>
            Receive stock
          </LinkButton>
        }
      />

      {summary.status === 'error' && (
        <Card>
          <QueryView query={summary} errorTitle="Could not load stock figures">
            {() => null}
          </QueryView>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Medicines" icon={Boxes} value={s?.totalProducts} hint={isNumber(s?.totalUnits) ? `${formatNumber(s.totalUnits)} units in stock` : undefined} loading={loading} error={err} href="/admin/products" />
        <StatTile
          label="Low or critical"
          icon={AlertTriangle}
          value={isNumber(s?.stock?.low) && isNumber(s?.stock?.critical) ? s.stock.low + s.stock.critical : null}
          hint={isNumber(s?.stock?.unclassified) && s.stock.unclassified > 0 ? `${s.stock.unclassified} without a reorder level` : 'At or below reorder level'}
          tone="warning"
          loading={loading}
          error={err}
          href="/admin/inventory/low-stock"
        />
        <StatTile label="Out of stock" icon={PackageX} value={s?.stock?.outOfStock} tone="danger" loading={loading} error={err} href="/admin/inventory/low-stock" />
        <StatTile
          label="Expired batches in stock"
          icon={CalendarClock}
          value={s?.expiry?.expired}
          hint={isNumber(s?.expiry?.within30Days) ? `${s.expiry.within30Days} more expire within 30 days` : undefined}
          tone={isNumber(s?.expiry?.expired) && s.expiry.expired > 0 ? 'danger' : 'neutral'}
          loading={loading}
          error={err}
          href="/admin/inventory/expiry"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Alerts" description="Derived from current stock and batch records" />
          <QueryView
            query={alerts}
            errorTitle="Could not load alerts"
            isEmpty={(d) => d.length === 0}
            empty={<EmptyState title="No stock alerts" description="No expired or soon-expiring batches, and nothing below its reorder level." />}
          >
            {(rows) => (
              <ul className="divide-y divide-border">
                {rows.slice(0, 50).map((a: ApiData) => {
                  const sev = SEVERITY[a.severity] ?? { label: a.severity, tone: 'neutral' as Tone };
                  return (
                    <li key={a.id}>
                      <Link href={a.productId ? `/admin/products/${a.productId}` : '/admin/inventory'} className="flex items-start gap-3 px-5 py-3 hover:bg-surface">
                        <Badge tone={sev.tone} className="mt-0.5">
                          {sev.label}
                        </Badge>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-fg">{a.title}</p>
                          <p className="text-xs text-subtle">{a.message}</p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </QueryView>
        </Card>

        <Card className="self-start">
          <CardHeader title="Stock value" description="From batch records with stock remaining" />
          <QueryView query={summary} errorTitle="Could not load valuation">
            {(d) => (
              <dl className="divide-y divide-border">
                {[
                  ['At purchase cost', formatLkr(d.valuation?.cost)],
                  ['At retail price', formatLkr(d.valuation?.retail)],
                  ['Batches with stock', formatNumber(d.valuation?.stockedBatches)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 px-5 py-2.5">
                    <dt className="text-sm text-muted">{k}</dt>
                    <dd className="text-sm font-semibold text-fg tabular">{v}</dd>
                  </div>
                ))}
                {isNumber(d.valuation?.unpricedBatches) && d.valuation.unpricedBatches > 0 && (
                  <p className="px-5 py-3 text-xs text-warning">
                    {d.valuation.unpricedBatches} batch(es) have no retail price and are left out of the retail figure.
                  </p>
                )}
                {isNumber(d.totalUnits) && isNumber(d.batchUnits) && d.totalUnits !== d.batchUnits && (
                  <p className="px-5 py-3 text-xs text-subtle">
                    {formatNumber(d.totalUnits - d.batchUnits)} unit(s) in stock were recorded before batch tracking and are not valued here.
                  </p>
                )}
              </dl>
            )}
          </QueryView>
        </Card>
      </div>
    </PageBody>
  );
}
