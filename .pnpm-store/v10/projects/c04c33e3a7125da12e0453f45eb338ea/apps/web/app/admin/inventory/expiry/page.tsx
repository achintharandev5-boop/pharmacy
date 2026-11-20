'use client';

import React, { useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { adjustStock, getInventoryExpiryMatrix } from '@/app/actions/inventory';
import { InventoryHeader } from '@/components/shell/InventoryHeader';
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FormField,
  PageBody,
  QueryView,
  SegmentedControl,
  Textarea,
  useToast,
  type Column,
} from '@/components/ui';
import { useApiQuery } from '@/lib/useApiQuery';
import { daysUntil, formatDate, formatNumber, text, toNumberOrNull } from '@/lib/format';
import type { ApiData } from '@/lib/api/types';

type Bucket = 'expired' | 'expiring30' | 'expiring60' | 'expiring90' | 'noExpiryDate';

export default function ExpiryPage() {
  const toast = useToast();
  const [bucket, setBucket] = useState<Bucket>('expired');
  const matrix = useApiQuery(() => getInventoryExpiryMatrix(), []);
  const [target, setTarget] = useState<ApiData | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idemKey, setIdemKey] = useState('');

  const openWriteOff = (b: ApiData) => {
    setError(null);
    setReason(`Expired batch ${b.batch_number} removed from stock`);
    setIdemKey(`adj-${crypto.randomUUID()}`);
    setTarget(b);
  };

  const writeOff = async () => {
    if (!target) return;
    const qty = toNumberOrNull(target.quantity_available);
    if (!qty || qty <= 0 || reason.trim().length < 3) return;
    setBusy(true);
    const res = await adjustStock({ productId: target.product_id, batchId: target.id, type: 'EXPIRED', quantity: qty, reason: reason.trim() }, idemKey);
    setBusy(false);
    if (!res.ok) {
      setError(`Write-off not recorded: ${res.error}`);
      setTarget(null);
      return;
    }
    toast.success(`Batch ${target.batch_number}: ${qty} unit(s) written off.`);
    setTarget(null);
    matrix.retry();
  };

  const columns: Column<ApiData>[] = [
    { key: 'product', header: 'Medicine', cell: (b) => b.products?.name ?? 'Unknown medicine' },
    { key: 'batch', header: 'Batch', cell: (b) => <span className="font-mono">{b.batch_number}</span> },
    {
      key: 'expiry',
      header: 'Expiry',
      cell: (b) => {
        const d = daysUntil(b.expiry_date);
        return (
          <span className="flex flex-col">
            <span>{b.expiry_date ? formatDate(b.expiry_date) : 'Not recorded'}</span>
            {d !== null && <span className={`text-xs font-medium ${d < 0 ? 'text-danger' : 'text-warning'}`}>{d < 0 ? `${-d} day(s) ago` : `in ${d} day(s)`}</span>}
          </span>
        );
      },
    },
    { key: 'qty', header: 'Units left', align: 'right', cell: (b) => <span className="tabular">{formatNumber(b.quantity_available)}</span> },
    { key: 'supplier', header: 'Supplier', hideOnMobile: true, cell: (b) => text(b.suppliers?.name) },
    {
      key: 'action',
      header: <span className="sr-only">Action</span>,
      align: 'right',
      cell: (b) =>
        bucket === 'expired' ? (
          <Button size="sm" variant="danger-soft" onClick={() => openWriteOff(b)}>
            Write off
          </Button>
        ) : null,
    },
  ];

  const counts = matrix.data;
  const options = [
    { id: 'expired', label: 'Expired', count: counts?.expired?.length },
    { id: 'expiring30', label: '≤ 30 days', count: counts?.expiring30?.length },
    { id: 'expiring60', label: '31–60 days', count: counts?.expiring60?.length },
    { id: 'expiring90', label: '61–90 days', count: counts?.expiring90?.length },
    { id: 'noExpiryDate', label: 'No expiry recorded', count: counts?.noExpiryDate?.length },
  ];

  return (
    <PageBody>
      <InventoryHeader title="Expiry" description="Batches with stock remaining, grouped by expiry. Expired stock cannot be dispensed." />
      {error && (
        <Alert title="Write-off failed" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Card className="overflow-hidden">
        <div className="border-b border-border p-4">
          <SegmentedControl label="Expiry window" options={options} value={bucket} onChange={(v) => setBucket(v as Bucket)} />
        </div>
        <QueryView query={matrix} errorTitle="Could not load expiry data">
          {(m) => {
            const rows: ApiData[] = Array.isArray(m[bucket]) ? m[bucket] : [];
            return rows.length === 0 ? (
              <EmptyState icon={CalendarCheck} title={bucket === 'expired' ? 'No expired stock' : 'No batches in this window'} />
            ) : (
              <DataTable caption="Batches by expiry" columns={columns} rows={rows} rowKey={(b) => b.id} />
            );
          }}
        </QueryView>
      </Card>
      <ConfirmDialog
        open={Boolean(target)}
        onCancel={() => setTarget(null)}
        onConfirm={writeOff}
        busy={busy}
        tone="danger"
        title="Write off expired batch?"
        description="This reduces recorded stock and is kept in the stock ledger. Requires the pharmacist or administrator role."
        confirmLabel="Write off"
      >
        {target && (
          <div className="space-y-3 text-sm">
            <p>
              <strong>{target.products?.name}</strong>, batch <span className="font-mono">{target.batch_number}</span>: remove{' '}
              <strong className="tabular">{formatNumber(target.quantity_available)}</strong> unit(s).
            </p>
            <FormField label="Reason" required hint="Recorded with the stock movement." error={reason.trim().length < 3 ? 'Enter a reason.' : null}>
              {(f) => <Textarea {...f} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}
            </FormField>
          </div>
        )}
      </ConfirmDialog>
    </PageBody>
  );
}
