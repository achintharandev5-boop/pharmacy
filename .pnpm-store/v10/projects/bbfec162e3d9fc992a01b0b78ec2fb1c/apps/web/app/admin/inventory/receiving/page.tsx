'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { receiveStock } from '@/app/actions/inventory';
import { getSuppliers } from '@/app/actions/suppliers';
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
  IconButton,
  Input,
  LinkButton,
  PageBody,
  Select,
  SkeletonRows,
  Textarea,
} from '@/components/ui';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatLkr, formatNumber } from '@/lib/format';
import type { ApiData } from '@/lib/api/types';

interface Line {
  key: string;
  productId: string;
  batchNumber: string;
  quantity: string;
  purchaseCost: string;
  retailPrice: string;
  expiryDate: string;
}

// Every value must come from the delivery: lines start blank, nothing is pre-filled or guessed.
const newLine = (): Line => ({ key: crypto.randomUUID(), productId: '', batchNumber: '', quantity: '', purchaseCost: '', retailPrice: '', expiryDate: '' });

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type LineErrors = Partial<Record<keyof Line, string>>;

function validateLine(l: Line, today: string): LineErrors {
  const e: LineErrors = {};
  if (!l.productId) e.productId = 'Select the medicine.';
  if (!l.batchNumber.trim()) e.batchNumber = 'Enter the batch number from the pack.';
  if (!/^\d+$/.test(l.quantity) || Number(l.quantity) <= 0) e.quantity = 'Whole number above 0.';
  if (!/^\d+(\.\d{1,2})?$/.test(l.purchaseCost)) e.purchaseCost = 'Enter the unit cost.';
  if (l.retailPrice && !/^\d+(\.\d{1,2})?$/.test(l.retailPrice)) e.retailPrice = 'Invalid price.';
  if (!l.expiryDate) e.expiryDate = 'Enter the expiry date from the pack.';
  else if (l.expiryDate < today) e.expiryDate = 'This date has passed: expired stock cannot be received.';
  return e;
}

export default function ReceiveStockPage() {
  const suppliers = useApiQuery(() => getSuppliers(), []);
  const products = useApiQuery(() => getAdminProducts(), []);
  const today = localToday();

  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [grnNumber, setGrnNumber] = useState('');
  const [receivedDate, setReceivedDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [showErrors, setShowErrors] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiData | null>(null);
  // One key per receipt: a retry after a lost response cannot receive the stock twice.
  const [idemKey, setIdemKey] = useState(() => `grn-${crypto.randomUUID()}`);

  const productById = useMemo(() => new Map((products.data ?? []).map((p: ApiData) => [p.id, p])), [products.data]);
  const lineErrors = lines.map((l) => validateLine(l, today));
  const supplierError = supplierId ? null : 'Select the supplier.';
  const dateError = !receivedDate ? 'Enter the date received.' : receivedDate > today ? 'Cannot be in the future.' : null;
  const valid = !supplierError && !dateError && lineErrors.every((e) => Object.keys(e).length === 0);
  const totalUnits = lines.reduce((n, l) => n + (Number(l.quantity) || 0), 0);
  const totalCost = lines.reduce((n, l) => n + (Number(l.quantity) || 0) * (Number(l.purchaseCost) || 0), 0);

  const update = (key: string, field: keyof Line, value: string) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, [field]: value } : l)));

  const review = (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    setSubmitError(null);
    if (valid) setConfirming(true);
  };

  const submit = async () => {
    setSubmitting(true);
    const res = await receiveStock(
      {
        supplierId,
        invoiceNumber: invoiceNumber.trim() || undefined,
        grnNumber: grnNumber.trim() || undefined,
        receivedDate,
        notes: notes.trim() || undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          batchNumber: l.batchNumber.trim(),
          quantity: Number(l.quantity),
          purchaseCost: Number(l.purchaseCost),
          retailPrice: l.retailPrice ? Number(l.retailPrice) : undefined,
          expiryDate: l.expiryDate,
        })),
      },
      idemKey,
    );
    setSubmitting(false);
    setConfirming(false);
    if (!res.ok) {
      setSubmitError(res.error);
      return;
    }
    setResult(res.data);
  };

  const reset = () => {
    setSupplierId('');
    setInvoiceNumber('');
    setGrnNumber('');
    setReceivedDate(localToday());
    setNotes('');
    setLines([newLine()]);
    setShowErrors(false);
    setResult(null);
    setIdemKey(`grn-${crypto.randomUUID()}`);
  };

  if (result) {
    return (
      <PageBody>
        <InventoryHeader title="Receive stock" />
        <Card className="mx-auto max-w-xl">
          <CardBody className="space-y-4 text-center">
            <CheckCircle2 size={40} className="mx-auto text-success" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold text-fg">Stock received</h2>
              <p className="text-sm text-subtle">The server recorded this receipt, its batches and stock movements.</p>
            </div>
            <dl className="mx-auto grid max-w-xs grid-cols-2 gap-2 text-left text-sm">
              <dt className="text-subtle">GRN</dt>
              <dd className="font-mono text-fg">{result.grnNumber}</dd>
              <dt className="text-subtle">Lines</dt>
              <dd className="tabular text-fg">{formatNumber(result.lineCount)}</dd>
              <dt className="text-subtle">Units</dt>
              <dd className="tabular text-fg">{formatNumber(result.unitCount)}</dd>
            </dl>
            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <Button variant="primary" onClick={reset}>
                Receive another delivery
              </Button>
              <LinkButton href="/admin/inventory/movements">View stock movements</LinkButton>
            </div>
          </CardBody>
        </Card>
      </PageBody>
    );
  }

  const loading = suppliers.status === 'loading' || products.status === 'loading';
  const loadError = suppliers.status === 'error' ? suppliers : products.status === 'error' ? products : null;

  return (
    <PageBody>
      <InventoryHeader title="Receive stock" description="Record a supplier delivery (goods received note). Requires the pharmacist or administrator role." />
      {loading ? (
        <Card>
          <SkeletonRows rows={4} label="Loading suppliers and medicines" />
        </Card>
      ) : loadError ? (
        <Card>
          <ErrorState title="Could not load suppliers or medicines" message={loadError.error ?? ''} onRetry={loadError.retry} />
        </Card>
      ) : (suppliers.data ?? []).length === 0 ? (
        <Alert tone="info" title="Add a supplier first">
          Every delivery is recorded against a supplier. <Link href="/admin/inventory/suppliers" className="font-semibold underline">Add a supplier</Link>, then return here.
        </Alert>
      ) : (
        <form onSubmit={review} noValidate className="space-y-6">
          {submitError && (
            <Alert title="Stock was not received" onDismiss={() => setSubmitError(null)}>
              {submitError} Nothing was changed. You can correct the form and submit again.
            </Alert>
          )}
          <Card>
            <CardHeader title="Delivery" />
            <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="Supplier" required error={showErrors ? supplierError : null}>
                {(f) => (
                  <Select {...f} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                    <option value="">Select supplier</option>
                    {(suppliers.data ?? [])
                      .filter((s: ApiData) => s.active !== false)
                      .map((s: ApiData) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </Select>
                )}
              </FormField>
              <FormField label="Supplier invoice no.">{(f) => <Input {...f} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />}</FormField>
              <FormField label="GRN number" hint="Leave blank to number automatically.">
                {(f) => <Input {...f} value={grnNumber} onChange={(e) => setGrnNumber(e.target.value)} />}
              </FormField>
              <FormField label="Date received" required error={showErrors ? dateError : null}>
                {(f) => <Input {...f} type="date" max={today} value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />}
              </FormField>
              <FormField label="Notes" className="sm:col-span-2 lg:col-span-4">
                {(f) => <Textarea {...f} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
              </FormField>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={`Items (${lines.length})`}
              description="Batch number, quantity and expiry exactly as printed on the packs."
              actions={
                <Button size="sm" icon={Plus} onClick={() => setLines((ls) => [...ls, newLine()])}>
                  Add line
                </Button>
              }
            />
            <ol className="divide-y divide-border">
              {lines.map((l, i) => {
                const err = showErrors ? lineErrors[i] : {};
                return (
                  <li key={l.key} className="grid grid-cols-2 gap-3 p-4 md:grid-cols-12 md:items-start">
                    <FormField label={`Medicine (line ${i + 1})`} required error={err.productId} className="col-span-2 md:col-span-4">
                      {(f) => (
                        <Select {...f} value={l.productId} onChange={(e) => update(l.key, 'productId', e.target.value)}>
                          <option value="">Select medicine</option>
                          {(products.data ?? [])
                            .filter((p: ApiData) => p.is_active !== false)
                            .map((p: ApiData) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </Select>
                      )}
                    </FormField>
                    <FormField label="Batch no." required error={err.batchNumber} className="md:col-span-2">
                      {(f) => <Input {...f} value={l.batchNumber} onChange={(e) => update(l.key, 'batchNumber', e.target.value)} />}
                    </FormField>
                    <FormField label="Expiry" required error={err.expiryDate} className="md:col-span-2">
                      {(f) => <Input {...f} type="date" min={today} value={l.expiryDate} onChange={(e) => update(l.key, 'expiryDate', e.target.value)} />}
                    </FormField>
                    <FormField label="Quantity" required error={err.quantity} className="md:col-span-1">
                      {(f) => <Input {...f} inputMode="numeric" value={l.quantity} onChange={(e) => update(l.key, 'quantity', e.target.value)} />}
                    </FormField>
                    <FormField label="Unit cost" required error={err.purchaseCost} className="md:col-span-1">
                      {(f) => <Input {...f} inputMode="decimal" value={l.purchaseCost} onChange={(e) => update(l.key, 'purchaseCost', e.target.value)} />}
                    </FormField>
                    <FormField label="Retail price" error={err.retailPrice} className="md:col-span-1">
                      {(f) => <Input {...f} inputMode="decimal" value={l.retailPrice} onChange={(e) => update(l.key, 'retailPrice', e.target.value)} />}
                    </FormField>
                    <div className="flex items-end justify-end md:col-span-1 md:pt-6">
                      <IconButton
                        icon={Trash2}
                        label={`Remove line ${i + 1}`}
                        disabled={lines.length === 1}
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                      />
                    </div>
                    {l.productId && productById.get(l.productId)?.stock_quantity != null && (
                      <p className="col-span-2 text-xs text-subtle md:col-span-12">
                        Currently in stock: <span className="tabular">{formatNumber(productById.get(l.productId)?.stock_quantity)}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                <span className="tabular font-semibold text-fg">{formatNumber(totalUnits)}</span> unit(s) · cost{' '}
                <span className="tabular font-semibold text-fg">{formatLkr(totalCost)}</span>
              </p>
              <Button type="submit" variant="primary">
                Review and receive
              </Button>
            </div>
          </Card>
        </form>
      )}
      <ConfirmDialog
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={submit}
        busy={submitting}
        title="Receive this stock?"
        description="Adds the units to stock, creates or tops up batches, and records each line in the stock ledger."
        confirmLabel="Receive stock"
      >
        <ul className="divide-y divide-border rounded-ui border border-border text-sm">
          {lines.map((l) => (
            <li key={l.key} className="flex justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate">{productById.get(l.productId)?.name}</span>
                <span className="text-xs text-subtle">
                  Batch {l.batchNumber} · exp {l.expiryDate}
                </span>
              </span>
              <span className="tabular shrink-0">+{l.quantity}</span>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </PageBody>
  );
}
