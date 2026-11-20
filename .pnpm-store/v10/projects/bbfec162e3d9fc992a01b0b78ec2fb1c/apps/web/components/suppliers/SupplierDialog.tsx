'use client';

import React, { useState } from 'react';
import { createSupplier, updateSupplier } from '@/app/actions/suppliers';
import { Alert, Button, Dialog, FormField, Input, Textarea } from '@/components/ui';
import type { ApiData } from '@/lib/api/types';

const FIELDS = ['name', 'contact_person', 'phone', 'email', 'address', 'registration_number', 'notes'] as const;
type Form = Record<(typeof FIELDS)[number], string> & { active: boolean };

const fromSupplier = (s?: ApiData): Form => ({
  name: s?.name ?? '',
  contact_person: s?.contact_person ?? '',
  phone: s?.phone ?? '',
  email: s?.email ?? '',
  address: s?.address ?? '',
  registration_number: s?.registration_number ?? '',
  notes: s?.notes ?? '',
  active: s?.active !== false,
});

/** Render only while open (`{open && <SupplierDialog open ... />}`) so the form starts fresh. */
export function SupplierDialog({ open, supplier, onClose, onSaved }: { open: boolean; supplier?: ApiData; onClose: () => void; onSaved: (s: ApiData) => void }) {
  const editing = Boolean(supplier?.id);
  const [form, setForm] = useState<Form>(() => fromSupplier(supplier));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: (typeof FIELDS)[number]) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Enter the supplier name.';
    if (form.phone.trim() && !/^[+\d\s()-]{7,25}$/.test(form.phone.trim())) next.phone = 'Enter a valid phone number.';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const payload: Record<string, unknown> = { active: form.active };
    for (const k of FIELDS) payload[k] = form[k].trim();
    setSaving(true);
    setSaveError(null);
    const res = editing ? await updateSupplier(supplier!.id, payload) : await createSupplier(payload);
    setSaving(false);
    if (!res.ok) {
      setSaveError(res.error);
      return;
    }
    onSaved(res.data);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={saving}
      size="lg"
      title={editing ? `Edit ${supplier?.name}` : 'Add supplier'}
      description="Requires the pharmacist or administrator role."
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="supplier-form" variant="primary" loading={saving}>
            {editing ? 'Save changes' : 'Add supplier'}
          </Button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {saveError && (
          <Alert className="sm:col-span-2" title="Not saved">
            {saveError}
          </Alert>
        )}
        <FormField label="Supplier name" required error={errors.name} className="sm:col-span-2">
          {(f) => <Input {...f} value={form.name} onChange={set('name')} data-autofocus />}
        </FormField>
        <FormField label="Contact person">{(f) => <Input {...f} value={form.contact_person} onChange={set('contact_person')} />}</FormField>
        <FormField label="Phone" error={errors.phone}>
          {(f) => <Input {...f} inputMode="tel" value={form.phone} onChange={set('phone')} />}
        </FormField>
        <FormField label="Email" error={errors.email}>
          {(f) => <Input {...f} type="email" value={form.email} onChange={set('email')} />}
        </FormField>
        <FormField label="Registration number">{(f) => <Input {...f} value={form.registration_number} onChange={set('registration_number')} />}</FormField>
        <FormField label="Address" className="sm:col-span-2">
          {(f) => <Input {...f} value={form.address} onChange={set('address')} />}
        </FormField>
        <FormField label="Notes" className="sm:col-span-2">
          {(f) => <Textarea {...f} rows={2} value={form.notes} onChange={set('notes')} />}
        </FormField>
        <label className="flex items-center gap-2 text-sm text-fg sm:col-span-2">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="h-4 w-4 accent-[var(--color-primary)]" />
          Active (available when receiving stock)
        </label>
      </form>
    </Dialog>
  );
}
