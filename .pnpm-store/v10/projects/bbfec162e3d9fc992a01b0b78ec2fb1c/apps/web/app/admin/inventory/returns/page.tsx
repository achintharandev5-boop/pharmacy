'use client';

import React, { useState } from 'react';
import { Undo2 } from 'lucide-react';
import { disposePatientReturn, getPatientReturns, recordPatientReturn } from '@/app/actions/inventory';
import { getAdminProducts } from '@/app/actions/admin';
import { InventoryHeader } from '@/components/shell/InventoryHeader';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FormField,
  Input,
  PageBody,
  QueryView,
  SegmentedControl,
  Select,
  StatusBadge,
  Textarea,
  useToast,
  type Column,
} from '@/components/ui';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatDateTime, formatNumber, text } from '@/lib/format';
import type { ApiData } from '@/lib/api/types';

const STATUSES = [
  { id: 'HELD_FOR_REVIEW', label: 'Held for review' },
  { id: 'DISPOSED', label: 'Disposed' },
  { id: 'ALL', label: 'All' },
];

const columns: Column<ApiData>[] = [
  { key: 'date', header: 'Recorded', cell: (r) => formatDateTime(r.created_at) },
  {
    key: 'medicine',
    header: 'Medicine',
    cell: (r) => (
      <span>
        {r.product_name_text}
        {r.batch_number && <span className="block font-mono text-xs font-normal text-subtle">Batch {r.batch_number}</span>}
      </span>
    ),
  },
  { key: 'qty', header: 'Units', align: 'right', cell: (r) => <span className="tabular">{formatNumber(r.quantity)}</span> },
  { key: 'reason', header: 'Reason', hideOnMobile: true, cell: (r) => text(r.reason) },
  { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
];

/**
 * Medicine brought back by patients. A return is recorded and held for review; it is never
 * added back to dispensable stock. Supplier returns are recorded under Adjustments.
 */
export default function PatientReturnsPage() {
  const toast = useToast();
  const [status, setStatus] = useState('HELD_FOR_REVIEW');
  const returns = useApiQuery(() => getPatientReturns(status), [status]);
  const products = useApiQuery(() => getAdminProducts(), []);

  const [productId, setProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [disposing, setDisposing] = useState<ApiData | null>(null);
  const [note, setNote] = useState('');
  const [disposeError, setDisposeError] = useState<string | null>(null);

  const errors = {
    medicine: productId || productName.trim() ? null : 'Select the medicine or enter its name.',
    quantity: /^\d+$/.test(quantity) && Number(quantity) > 0 ? null : 'Enter a whole number above 0.',
    reason: reason.trim().length < 3 ? 'Say why it was returned.' : null,
  };
  const valid = !errors.medicine && !errors.quantity && !errors.reason;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (!valid) return;
    setBusy(true);
    setError(null);
    const res = await recordPatientReturn({
      productId: productId || undefined,
      productName: productId ? undefined : productName.trim(),
      batchNumber: batchNumber.trim() || undefined,
      quantity: Number(quantity),
      reason: reason.trim(),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success('Return recorded and held for review. Stock was not changed.');
    setProductId('');
    setProductName('');
    setBatchNumber('');
    setQuantity('');
    setReason('');
    setShowErrors(false);
    returns.retry();
  };

  const dispose = async () => {
    if (!disposing) return;
    if (note.trim().length < 3) {
      setDisposeError('Describe how it was disposed of.');
      return;
    }
    setBusy(true);
    const res = await disposePatientReturn(disposing.id, note.trim());
    setBusy(false);
    if (!res.ok) {
      setDisposeError(res.error);
      return;
    }
    toast.success('Disposal recorded.');
    setDisposing(null);
    returns.retry();
  };

  const allColumns: Column<ApiData>[] = [
    ...columns,
    {
      key: 'action',
      header: <span className="sr-only">Action</span>,
      align: 'right',
      cell: (r) =>
        r.status === 'HELD_FOR_REVIEW' ? (
          <Button
            size="sm"
            onClick={() => {
              setDisposing(r);
              setNote('');
              setDisposeError(null);
            }}
          >
            Record disposal
          </Button>
        ) : (
          <span className="text-xs text-subtle">{text(r.disposal_note)}</span>
        ),
    },
  ];

  return (
    <PageBody>
      <InventoryHeader
        title="Returns"
        description="Medicine brought back by patients. Returns are held for review and never added back to dispensable stock. To send stock back to a supplier, use Adjustments → Returned to the supplier."
      />
      <Card className="max-w-3xl">
        <CardHeader title="Record a patient return" />
        <CardBody>
          <form noValidate onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {error && (
              <Alert className="sm:col-span-2" title="Return was not recorded" onDismiss={() => setError(null)}>
                {error}
              </Alert>
            )}
            <FormField label="Medicine" required error={showErrors ? errors.medicine : null} hint={products.status === 'error' ? 'Medicine list unavailable; enter the name instead.' : undefined}>
              {(f) => (
                <Select {...f} value={productId} onChange={(e) => setProductId(e.target.value)} disabled={products.status !== 'success'}>
                  <option value="">Not in the catalogue</option>
                  {(products.data ?? []).map((p: ApiData) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label="Name on the pack" hint={productId ? 'Using the selected catalogue medicine.' : 'Required when the medicine is not in the catalogue.'}>
              {(f) => <Input {...f} value={productName} onChange={(e) => setProductName(e.target.value)} disabled={Boolean(productId)} />}
            </FormField>
            <FormField label="Batch number" hint="As printed on the pack, if readable.">
              {(f) => <Input {...f} value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />}
            </FormField>
            <FormField label="Quantity (units)" required error={showErrors ? errors.quantity : null}>
              {(f) => <Input {...f} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />}
            </FormField>
            <FormField label="Reason" required error={showErrors ? errors.reason : null} className="sm:col-span-2">
              {(f) => <Textarea {...f} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Treatment stopped by doctor" />}
            </FormField>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" variant="primary" loading={busy && !disposing}>
                Record return
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-sm font-semibold text-fg">Recorded returns</h2>
          <SegmentedControl label="Return status" options={STATUSES} value={status} onChange={setStatus} />
        </div>
        <QueryView
          query={returns}
          errorTitle="Could not load returns"
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState icon={Undo2} title="No returns" description={status === 'HELD_FOR_REVIEW' ? 'Nothing is waiting for review.' : 'No returns with this status.'} />}
        >
          {(rows) => <DataTable caption="Patient returns" columns={allColumns} rows={rows} rowKey={(r) => r.id} />}
        </QueryView>
      </Card>

      <ConfirmDialog
        open={disposing !== null}
        onCancel={() => setDisposing(null)}
        onConfirm={dispose}
        busy={busy}
        title="Record disposal?"
        description="The returned units are recorded as disposed of. They are never added to stock. Requires the pharmacist or administrator role."
        confirmLabel="Record disposal"
      >
        <div className="space-y-3">
          {disposeError && <Alert title="Disposal was not recorded">{disposeError}</Alert>}
          <p className="text-sm text-fg">
            {disposing?.product_name_text} · {formatNumber(disposing?.quantity)} unit(s)
          </p>
          <FormField label="How it was disposed of" required>
            {(f) => <Textarea {...f} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Sent for destruction with expired stock" />}
          </FormField>
        </div>
      </ConfirmDialog>
    </PageBody>
  );
}
