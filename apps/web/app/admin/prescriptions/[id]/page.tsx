'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { getAdminPrescriptionById } from '@/app/actions/admin';
import { Badge, Button, Card, CardBody, CardHeader, DetailItem, EmptyState, PageBody, PageHeader, QueryView, StatusBadge } from '@/components/ui';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatDate, formatDateTime, formatNumber, text } from '@/lib/format';
import { REPRINT_UNAVAILABLE_REASON } from '@/lib/reprint';
import type { ApiData } from '@/lib/api/types';

function dosage(item: ApiData): string {
  const parts = [
    ['Morning', item.morning_qty],
    ['Lunch', item.lunch_qty],
    ['Night', item.night_qty],
  ]
    .filter(([, q]) => Number(q) > 0)
    .map(([label, q]) => `${label} ${q}`);
  if (item.frequency_type) parts.push(`${item.frequency_type}${item.frequency_qty ? ` ${item.frequency_qty}` : ''}`);
  if (item.stat_qty) parts.push(`STAT ${item.stat_qty}${item.stat_follow_up ? ` then ${item.stat_follow_up}` : ''}`);
  return parts.join(' · ');
}

/** The expiry text that was on the label; the date column holds only unambiguous dates. */
function labelExpiry(item: ApiData): string {
  // Exactly as printed; the GRN batch it came from is recorded with the label (Feature #22).
  const printed = item.instructions_json?.labelExpiryText ?? (item.expiry_date ? formatDate(item.expiry_date) : '—');
  const batch = item.instructions_json?.expiryBatch?.batchNumber;
  return batch ? `${printed} (batch ${batch})` : printed;
}

export default function PrescriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useApiQuery(() => getAdminPrescriptionById(id), [id]);
  const rx = query.data?.prescription;

  return (
    <PageBody>
      <PageHeader
        title={rx?.prescription_number ?? 'Prescription'}
        breadcrumbs={[{ label: 'Prescriptions', href: '/admin/prescriptions' }, { label: rx?.prescription_number ?? 'Prescription' }]}
        actions={
          <Button icon={Printer} disabled title={REPRINT_UNAVAILABLE_REASON} aria-describedby="reprint-reason">
            Reprint label
          </Button>
        }
      />
      <p id="reprint-reason" className="-mt-3 text-xs text-subtle">
        {REPRINT_UNAVAILABLE_REASON}
      </p>
      <QueryView query={query} errorTitle="Could not load this prescription">
        {(data) => {
          const p = data.prescription ?? {};
          const items: ApiData[] = Array.isArray(p.prescription_items) ? p.prescription_items : [];
          const events: ApiData[] = Array.isArray(data.events) ? data.events : [];
          return (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <Card>
                  <CardHeader title="Summary" actions={<StatusBadge status={p.status} />} />
                  <CardBody>
                    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      <DetailItem label="Patient">
                        {p.customer_id ? (
                          <Link href={`/admin/patients/${p.customer_id}`} className="text-primary hover:underline">
                            {text(p.customer_name_text)}
                          </Link>
                        ) : (
                          <>
                            {text(p.customer_name_text)} <span className="text-xs text-subtle">(not linked)</span>
                          </>
                        )}
                      </DetailItem>
                      <DetailItem label="Phone">
                        <span className="tabular">{text(p.customer_phone)}</span>
                      </DetailItem>
                      <DetailItem label="Saved">{formatDateTime(p.created_at)}</DetailItem>
                      <DetailItem label="Last printed">{p.printed_at ? formatDateTime(p.printed_at) : 'Not printed'}</DetailItem>
                      <DetailItem label="Reprints">
                        <span className="tabular">{formatNumber(p.print_count)}</span>
                      </DetailItem>
                    </dl>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title={`Labels (${items.length})`} description="As recorded when the prescription was saved" />
                  {items.length === 0 ? (
                    <EmptyState title="No labels recorded" />
                  ) : (
                    <ol className="divide-y divide-border">
                      {items.map((item, i) => (
                        <li key={item.id ?? i} className="space-y-2 px-5 py-4">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-sm font-semibold text-fg">
                              {i + 1}. {item.product_name_snapshot}
                              {item.alternative_product_name && <span className="font-normal text-subtle"> · brand: {item.alternative_product_name}</span>}
                            </p>
                            <span className="text-sm text-muted tabular">Qty {formatNumber(item.quantity)}</span>
                          </div>
                          {!item.product_id && <Badge tone="neutral">Named manually · no stock deducted</Badge>}
                          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <DetailItem label="Dosage">{dosage(item) || '—'}</DetailItem>
                            <DetailItem label="Duration">{item.days ? `${item.days} days` : '—'}</DetailItem>
                            <DetailItem label="Expiry on label">{labelExpiry(item)}</DetailItem>
                          </dl>
                          {item.final_instruction_text && (
                            <div>
                              <p className="text-xs font-medium text-subtle">Label text</p>
                              <p className="sinhala-text mt-0.5 text-base text-fg">{item.final_instruction_text}</p>
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </Card>
              </div>

              <Card className="self-start">
                <CardHeader title="History" />
                {events.length === 0 ? (
                  <EmptyState title="No events recorded" />
                ) : (
                  <ol className="space-y-4 p-5">
                    {events.map((ev) => (
                      <li key={ev.id} className="flex gap-3">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-border-strong" aria-hidden="true" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={ev.event_type} />
                            <span className="text-xs text-subtle">{formatDateTime(ev.created_at)}</span>
                          </div>
                          {ev.metadata?.reason && <p className="mt-1 text-sm text-muted">Reason: {ev.metadata.reason}</p>}
                          {ev.metadata?.failureReason && <p className="mt-1 text-sm text-danger">{ev.metadata.failureReason}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            </div>
          );
        }}
      </QueryView>
    </PageBody>
  );
}
