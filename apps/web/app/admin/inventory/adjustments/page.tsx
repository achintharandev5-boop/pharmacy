'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { adjustStock, getInventoryBatches } from '@/app/actions/inventory';
import { getAdminProducts } from '@/app/actions/admin';
import { InventoryHeader } from '@/components/shell/InventoryHeader';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  ErrorState,
  FormField,
  Input,
  PageBody,
  Select,
  SkeletonRows,
  Textarea,
  useToast,
} from '@/components/ui';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatDate, formatNumber, toNumberOrNull } from '@/lib/format';
import type { ApiData } from '@/lib/api/types';

type AdjustmentType = 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'EXPIRED' | 'DAMAGED' | 'RETURNED';

const TYPES: { id: AdjustmentType; label: string; decreases: boolean }[] = [
  { id: 'ADJUSTMENT_OUT', label: 'Decrease: count discrepancy or shrinkage', decreases: true },
  { id: 'ADJUSTMENT_IN', label: 'Increase: found stock or recount', decreases: false },
  { id: 'DAMAGED', label: 'Decrease: damaged or broken units', decreases: true },
  { id: 'EXPIRED', label: 'Decrease: expired stock write-off', decreases: true },
  { id: 'RETURNED', label: 'Increase: customer return to stock', decreases: false },
];

function AdjustmentsInner() {
  const params = useSearchParams();
  const toast = useToast();
  const products = useApiQuery(() => getAdminProducts(), []);
  const batches = useApiQuery(() => getInventoryBatches(), []);

  const [productId, setProductId] = useState(params.get('product') ?? '');
  const [batchId, setBatchId] = useState('');
  const [type, setType] = useState<AdjustmentType>('ADJUSTMENT_OUT');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idemKey, setIdemKey] = useState(() => `adj-${crypto.randomUUID()}`);

  const product = useMemo(() => (products.data ?? []).find((p: ApiData) => p.id === productId), [products.data, productId]);
  const productBatches = useMemo(
    () => (batches.data ?? []).filter((b: ApiData) => b.product_id === productId && (toNumberOrNull(b.quantity_available) ?? 0) >= 0),
    [batches.data, productId],
  );
  const batch = productBatches.find((b: ApiData) => b.id === batchId);
  const meta = TYPES.find((t) => t.id === type)!;
  const qty = Number(quantity);
  const available = batch ? toNumberOrNull(batch.quantity_available) : toNumberOrNull(product?.stock_quantity);

  const errors = {
    product: productId ? null : 'Select the medicine.',
    quantity: !/^\d+$/.test(quantity) || qty <= 0 ? 'Enter a whole number above 0.' : meta.decreases && available !== null && qty > available ? `Only ${available} unit(s) recorded.` : null,
    reason: reason.trim().length < 3 ? 'Explain the adjustment; it is kept in the stock ledger.' : null,
  };
  const valid = !errors.product && !errors.quantity && !errors.reason;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await adjustStock({ productId, batchId: batchId || undefined, type, quantity: qty, reason: reason.trim() }, idemKey);
    setBusy(false);
    setConfirming(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(`${product?.name}: stock ${formatNumber(res.data?.stockBefore)} → ${formatNumber(res.data?.stockAfter)}.`);
    setQuantity('');
    setReason('');
    setShowErrors(false);
    setIdemKey(`adj-${crypto.randomUUID()}`);
    products.retry();
    batches.retry();
  };

  if (products.status === 'loading' || batches.status === 'loading') {
    return (
      <PageBody>
        <InventoryHeader title="Adjustments" />
        <Card>
          <SkeletonRows rows={4} label="Loading medicines and batches" />
        </Card>
      </PageBody>
    );
  }
  const failed = products.status === 'error' ? products : batches.status === 'error' ? batches : null;

  return (
    <PageBody>
      <InventoryHeader title="Adjustments" description="Correct recorded stock. Every adjustment needs a reason and is kept in the stock ledger. Requires the pharmacist or administrator role." />
      {failed ? (
        <Card>
          <ErrorState title="Could not load medicines or batches" message={failed.error ?? ''} onRetry={failed.retry} />
        </Card>
      ) : (
        <Card className="max-w-3xl">
          <CardHeader title="New adjustment" />
          <CardBody>
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                setShowErrors(true);
                if (valid) setConfirming(true);
              }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              {error && (
                <Alert className="sm:col-span-2" title="Stock was not adjusted" onDismiss={() => setError(null)}>
                  {error}
                </Alert>
              )}
              <FormField label="Medicine" required error={showErrors ? errors.product : null} className="sm:col-span-2">
                {(f) => (
                  <Select
                    {...f}
                    value={productId}
                    onChange={(e) => {
                      setProductId(e.target.value);
                      setBatchId('');
                    }}
                  >
                    <option value="">Select medicine</option>
                    {(products.data ?? []).map((p: ApiData) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {formatNumber(p.stock_quantity)} in stock
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField label="Batch" hint={productBatches.length === 0 && productId ? 'This medicine has no batch records; only the stock total changes.' : 'Choose the batch when the units come from a specific one.'}>
                {(f) => (
                  <Select {...f} value={batchId} onChange={(e) => setBatchId(e.target.value)} disabled={!productId || productBatches.length === 0}>
                    <option value="">No specific batch (stock total only)</option>
                    {productBatches.map((b: ApiData) => (
                      <option key={b.id} value={b.id}>
                        {b.batch_number} · exp {formatDate(b.expiry_date)} · {formatNumber(b.quantity_available)} left
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField label="Type" required>
                {(f) => (
                  <Select {...f} value={type} onChange={(e) => setType(e.target.value as AdjustmentType)}>
                    {TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField
                label="Quantity (units)"
                required
                error={showErrors ? errors.quantity : null}
                hint={available !== null ? `${formatNumber(available)} unit(s) recorded ${batch ? 'in this batch' : 'in total'}` : undefined}
              >
                {(f) => <Input {...f} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />}
              </FormField>
              <div className="hidden sm:block" />
              <FormField label="Reason" required error={showErrors ? errors.reason : null} className="sm:col-span-2">
                {(f) => <Textarea {...f} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Monthly count found 2 fewer strips" />}
              </FormField>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" variant="primary">
                  Review adjustment
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}
      <ConfirmDialog
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={submit}
        busy={busy}
        tone={meta.decreases ? 'danger' : 'primary'}
        title="Record this adjustment?"
        description="This changes recorded stock and cannot be undone from this screen (record a correcting adjustment instead)."
        confirmLabel="Record adjustment"
      >
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-subtle">Medicine</dt>
          <dd className="text-fg">{product?.name}</dd>
          <dt className="text-subtle">Batch</dt>
          <dd className="text-fg">{batch?.batch_number ?? 'Stock total only'}</dd>
          <dt className="text-subtle">Change</dt>
          <dd className={`tabular font-semibold ${meta.decreases ? 'text-danger' : 'text-success'}`}>
            {meta.decreases ? '−' : '+'}
            {quantity}
          </dd>
          <dt className="text-subtle">Reason</dt>
          <dd className="text-fg">{reason}</dd>
        </dl>
      </ConfirmDialog>
    </PageBody>
  );
}

export default function AdjustmentsPage() {
  return (
    <Suspense>
      <AdjustmentsInner />
    </Suspense>
  );
}
