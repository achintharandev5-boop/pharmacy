'use client';

import React, { useState } from 'react';
import { createProduct, updateProduct, type ProductInput } from '@/app/actions/products';
import { Alert, Button, Checkbox, Dialog, FormField, Input, Select } from '@/components/ui';
import type { ApiData } from '@/lib/api/types';
import { PRODUCT_TYPES } from '@/lib/productType';

const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Drops', 'Injection', 'Inhaler', 'Cream', 'Ointment', 'Gel', 'Powder', 'Other'];

const TEXT_FIELDS = ['name', 'barcode', 'generic_name', 'brand_name', 'strength', 'dosage_form', 'product_type', 'category', 'manufacturer', 'unit_of_measure'] as const;
const INT_FIELDS = ['pack_size', 'reorder_level', 'minimum_stock', 'maximum_stock'] as const;

type FormState = Record<(typeof TEXT_FIELDS)[number] | (typeof INT_FIELDS)[number] | 'retail_price', string> & {
  rx_required: boolean;
  is_active: boolean;
};

function fromProduct(p?: ApiData): FormState {
  const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  return {
    name: s(p?.name),
    barcode: s(p?.barcode),
    generic_name: s(p?.generic_name),
    brand_name: s(p?.brand_name),
    strength: s(p?.strength),
    dosage_form: s(p?.dosage_form),
    product_type: s(p?.product_type),
    category: s(p?.category),
    manufacturer: s(p?.manufacturer),
    unit_of_measure: s(p?.unit_of_measure),
    pack_size: s(p?.pack_size),
    reorder_level: s(p?.reorder_level),
    minimum_stock: s(p?.minimum_stock),
    maximum_stock: s(p?.maximum_stock),
    retail_price: s(p?.retail_price),
    rx_required: p?.rx_required !== false,
    is_active: p?.is_active !== false,
  };
}

/**
 * Add or edit a catalogue entry. Stock and expiry are changed only by receiving and adjustments.
 * Render it only while open (`{open && <ProductDialog open ... />}`) so the form starts fresh.
 */
export function ProductDialog({
  open,
  product,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Present when editing. */
  product?: ApiData;
  onClose: () => void;
  onSaved: (saved: ApiData) => void;
}) {
  const editing = Boolean(product?.id);
  const [form, setForm] = useState<FormState>(() => fromProduct(product));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Enter the name printed on labels.';
    if (!/^[\w-]{1,64}$/.test(form.barcode.trim())) next.barcode = 'Enter the barcode (letters, digits, - or _).';
    for (const k of INT_FIELDS) {
      if (form[k].trim() && !/^\d+$/.test(form[k].trim())) next[k] = 'Enter a whole number.';
    }
    if (form.pack_size.trim() === '0') next.pack_size = 'Pack size must be at least 1.';
    if (form.retail_price.trim() && !/^\d+(\.\d{1,2})?$/.test(form.retail_price.trim())) next.retail_price = 'Enter a price such as 12.50.';
    const num = (k: string) => (form[k as keyof FormState] as string).trim();
    if (num('minimum_stock') && num('reorder_level') && Number(num('reorder_level')) < Number(num('minimum_stock'))) {
      next.reorder_level = 'Reorder level cannot be below the minimum stock.';
    }
    if (num('maximum_stock') && num('reorder_level') && Number(num('maximum_stock')) < Number(num('reorder_level'))) {
      next.maximum_stock = 'Maximum cannot be below the reorder level.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input: ProductInput = { rx_required: form.rx_required, is_active: form.is_active };
    for (const k of TEXT_FIELDS) {
      const v = form[k].trim();
      // When editing, an emptied field is sent as '' (stored as null); when adding, it is omitted.
      if (v || (editing && product?.[k])) (input as Record<string, unknown>)[k] = v;
    }
    for (const k of INT_FIELDS) if (form[k].trim()) (input as Record<string, unknown>)[k] = Number(form[k]);
    if (form.retail_price.trim()) input.retail_price = Number(form.retail_price);

    setSaving(true);
    setSaveError(null);
    const res = editing ? await updateProduct(product!.id, input) : await createProduct(input);
    setSaving(false);
    if (!res.ok) {
      setSaveError(res.error);
      return;
    }
    onSaved(res.data);
  };

  const field = (k: keyof FormState, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string, required?: boolean) => (
    <FormField label={label} hint={hint} error={errors[k]} required={required}>
      {(f) => <Input {...f} {...props} value={form[k] as string} onChange={set(k)} />}
    </FormField>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={saving}
      size="lg"
      title={editing ? `Edit ${product?.name}` : 'Add medicine'}
      description="Catalogue details only. Stock and expiry dates are recorded when stock is received."
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" variant="primary" loading={saving}>
            {editing ? 'Save changes' : 'Add medicine'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} noValidate className="space-y-5">
        {saveError && <Alert title="Not saved">{saveError}</Alert>}
        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-fg">Identification</legend>
          {field('name', 'Name on label', { 'data-autofocus': true } as never, 'Include the strength, e.g. “Panadol 500mg Tablets”.', true)}
          {field('barcode', 'Barcode', {}, undefined, true)}
          {field('generic_name', 'Generic name')}
          {field('brand_name', 'Brand name')}
          {field('strength', 'Strength', { placeholder: 'e.g. 500 mg' })}
          <FormField label="Product type" hint="Saved on the medicine record and selected automatically on labels.">
            {(f) => (
              <Select {...f} value={form.product_type} onChange={set('product_type')}>
                <option value="">Not specified</option>
                {Object.entries(PRODUCT_TYPES).map(([type, sinhala]) => (
                  <option key={type} value={type}>{type} · {sinhala}</option>
                ))}
                {form.product_type && !Object.hasOwn(PRODUCT_TYPES, form.product_type) && (
                  <option value={form.product_type}>{form.product_type} (existing value)</option>
                )}
              </Select>
            )}
          </FormField>
          <FormField label="Dosage form">
            {(f) => (
              <Select {...f} value={form.dosage_form} onChange={set('dosage_form')}>
                <option value="">Not specified</option>
                {DOSAGE_FORMS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                {form.dosage_form && !DOSAGE_FORMS.includes(form.dosage_form) && <option value={form.dosage_form}>{form.dosage_form}</option>}
              </Select>
            )}
          </FormField>
          {field('category', 'Category', { placeholder: 'e.g. Antibiotic' })}
          {field('manufacturer', 'Manufacturer')}
          {field('pack_size', 'Pack size', { inputMode: 'numeric' }, 'Units per pack')}
          {field('unit_of_measure', 'Unit', { placeholder: 'e.g. tablet, ml' })}
          {field('retail_price', 'Retail price (LKR)', { inputMode: 'decimal' }, 'Used for stock valuation only')}
        </fieldset>
        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <legend className="mb-2 text-sm font-semibold text-fg">Stock alerts</legend>
          {field('minimum_stock', 'Minimum', { inputMode: 'numeric' }, 'Critical below this')}
          {field('reorder_level', 'Reorder level', { inputMode: 'numeric' }, 'Low stock at or below')}
          {field('maximum_stock', 'Maximum', { inputMode: 'numeric' }, 'Used to suggest order size')}
        </fieldset>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-8">
          <label className="flex min-h-11 items-center gap-3 text-sm text-fg">
            <Checkbox checked={form.rx_required} onChange={set('rx_required')} />
            Prescription required
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm text-fg">
            <Checkbox checked={form.is_active} onChange={set('is_active')} />
            Active (can be dispensed)
          </label>
        </div>
      </form>
    </Dialog>
  );
}
