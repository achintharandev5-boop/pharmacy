'use client';

import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { getInventoryBatches, quarantineBatch, releaseBatch } from '@/app/actions/inventory';
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
  SearchInput,
  SegmentedControl,
  StatusBadge,
  Textarea,
  useToast,
  type Column,
} from '@/components/ui';
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

type QuarantineAction = { batch: ApiData; release: boolean };

export default function BatchesPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const batches = useApiQuery(() => getInventoryBatches(undefined, status), [status]);
  const q = search.trim().toLowerCase();

  const [action, setAction] = useState<QuarantineAction | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (batch: ApiData, release: boolean) => {
    setAction({ batch, release });
    setReason('');
    setError(null);
  };

  const submit = async () => {
    if (!action) return;
    if (reason.trim().length < 3) {
      setError('Give a reason; it is kept in the audit history.');
      return;
    }
    setBusy(true);
    const res = action.release ? await releaseBatch(action.batch.id, reason.trim()) : await quarantineBatch(action.batch.id, reason.trim());
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(`Batch ${action.batch.batch_number} ${action.release ? 'released' : 'quarantined'}.`);
    setAction(null);
    batches.retry();
  };

  const allColumns: Column<ApiData>[] = [
    ...columns,
    {
      key: 'action',
      header: <span className="sr-only">Action</span>,
      align: 'right',
      cell: (b) =>
        b.status === 'QUARANTINED' ? (
          <Button size="sm" onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              open(b, true);
            }}>
            Release
          </Button>
        ) : (
          <Button size="sm" onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              open(b, false);
            }}>
            Quarantine
          </Button>
        ),
    },
  ];

  return (
    <PageBody>
      <InventoryHeader
        title="Batches"
        description="Each received batch, earliest expiry first. A quarantined batch stays on record but is never dispensed. Quarantine and release need the pharmacist or administrator role."
      />
      <Card className="overflow-hidden">
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
              <DataTable caption="Batches" columns={allColumns} rows={shown} rowKey={(b) => b.id} rowHref={(b) => (b.product_id ? `/admin/products/${b.product_id}` : null)} />
            );
          }}
        </QueryView>
      </Card>
      <ConfirmDialog
        open={action !== null}
        onCancel={() => setAction(null)}
        onConfirm={submit}
        busy={busy}
        tone={action?.release ? 'primary' : 'danger'}
        title={action?.release ? `Release batch ${action?.batch.batch_number}?` : `Quarantine batch ${action?.batch.batch_number}?`}
        description={
          action?.release
            ? 'Its units become dispensable again. Expired batches and batches without an expiry date cannot be released.'
            : 'Its units stay on record but will not be dispensed until a pharmacist releases the batch.'
        }
        confirmLabel={action?.release ? 'Release batch' : 'Quarantine batch'}
      >
        <div className="space-y-3">
          {error && <Alert title={action?.release ? 'Batch was not released' : 'Batch was not quarantined'}>{error}</Alert>}
          <p className="text-sm text-fg">
            {action?.batch.products?.name ?? 'Unknown medicine'} · {formatNumber(action?.batch.quantity_available)} unit(s) · exp{' '}
            {action?.batch.expiry_date ? formatDate(action.batch.expiry_date) : 'not recorded'}
          </p>
          <FormField label="Reason" required>
            {(f) => <Textarea {...f} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged seal on carton" />}
          </FormField>
        </div>
      </ConfirmDialog>
    </PageBody>
  );
}
