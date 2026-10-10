'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { UserPlus, Users } from 'lucide-react';
import { getAllCustomers, createNewPerson, type PersonData } from '@/app/actions/customers';
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  FormField,
  Input,
  PageBody,
  PageHeader,
  QueryView,
  SearchInput,
  Select,
  Textarea,
  useToast,
  type Column,
} from '@/components/ui';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatDate, text } from '@/lib/format';

const ALLERGY_OPTIONS = [
  { value: '', label: 'Not recorded' },
  { value: 'NONE_KNOWN', label: 'No known allergies (confirmed with patient)' },
  { value: 'HAS_ALLERGIES', label: 'Has allergies' },
];

const columns: Column<PersonData>[] = [
  { key: 'name', header: 'Patient', cell: (p) => p.name },
  { key: 'phone', header: 'Mobile', cell: (p) => <span className="tabular">{p.phone_number}</span> },
  { key: 'age', header: 'Age / gender', hideOnMobile: true, cell: (p) => [p.age, p.gender].filter(Boolean).join(' · ') || '—' },
  { key: 'address', header: 'Address', hideOnMobile: true, cell: (p) => <span className="line-clamp-1">{text(p.address)}</span> },
  { key: 'created', header: 'Registered', hideOnMobile: true, cell: (p) => formatDate(p.created_at) },
];

function AddPatientDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (p: PersonData) => void }) {
  const empty = { name: '', phone_number: '', age: '', gender: '', address: '', medical_notes: '', allergy_status: '', allergies: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const close = () => {
    if (saving) return;
    setForm(empty);
    setErrors({});
    setSaveError(null);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Enter the patient’s name.';
    if (!/^[+\d\s-]{7,20}$/.test(form.phone_number.trim())) next.phone_number = 'Enter a phone number (digits, spaces, + or -).';
    if (form.allergy_status === 'HAS_ALLERGIES' && !form.allergies.trim()) next.allergies = 'List the allergies.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    setSaveError(null);
    const payload: Record<string, string> = {};
    for (const [k, v] of Object.entries(form)) if (v.trim()) payload[k] = v.trim();
    const res = await createNewPerson(payload as unknown as PersonData);
    setSaving(false);
    if (!res.success || !res.data) {
      setSaveError(res.error ?? 'The patient was not saved.');
      return;
    }
    setForm(empty);
    onSaved(res.data);
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      busy={saving}
      title="Add patient"
      description="Saved to the patient register. Required fields are marked *."
      size="lg"
      footer={
        <>
          <Button onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="add-patient" variant="primary" loading={saving}>
            Save patient
          </Button>
        </>
      }
    >
      <form id="add-patient" onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {saveError && (
          <Alert className="sm:col-span-2" title="Patient not saved">
            {saveError}
          </Alert>
        )}
        <FormField label="Full name" required error={errors.name}>
          {(f) => <Input {...f} value={form.name} onChange={set('name')} autoComplete="off" data-autofocus />}
        </FormField>
        <FormField label="Mobile number" required error={errors.phone_number}>
          {(f) => <Input {...f} value={form.phone_number} onChange={set('phone_number')} inputMode="tel" placeholder="07X XXX XXXX" />}
        </FormField>
        <FormField label="Age">
          {(f) => <Input {...f} value={form.age} onChange={set('age')} inputMode="numeric" />}
        </FormField>
        <FormField label="Gender">
          {(f) => (
            <Select {...f} value={form.gender} onChange={set('gender')}>
              <option value="">Not recorded</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </Select>
          )}
        </FormField>
        <FormField label="Address" className="sm:col-span-2">
          {(f) => <Input {...f} value={form.address} onChange={set('address')} />}
        </FormField>
        <FormField label="Allergy status" hint="Leave as “Not recorded” unless you have asked the patient." className="sm:col-span-2">
          {(f) => (
            <Select {...f} value={form.allergy_status} onChange={set('allergy_status')}>
              {ALLERGY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        {form.allergy_status === 'HAS_ALLERGIES' && (
          <FormField label="Allergies" required error={errors.allergies} className="sm:col-span-2">
            {(f) => <Input {...f} value={form.allergies} onChange={set('allergies')} placeholder="e.g. Penicillin (rash)" />}
          </FormField>
        )}
        <FormField label="Medical notes" className="sm:col-span-2">
          {(f) => <Textarea {...f} value={form.medical_notes} onChange={set('medical_notes')} />}
        </FormField>
      </form>
    </Dialog>
  );
}

function PatientsInner() {
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const patients = useApiQuery(() => getAllCustomers(), []);

  const filter = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/[\s-]/g, '');
    return (p: PersonData) =>
      !q || p.name?.toLowerCase().includes(q) || (digits.length > 0 && p.phone_number?.replace(/[\s-]/g, '').includes(digits));
  }, [search]);

  return (
    <PageBody>
      <PageHeader
        title="Patients"
        description="The patient register used by the label workstation."
        actions={
          <Button variant="primary" icon={UserPlus} onClick={() => setAdding(true)}>
            Add patient
          </Button>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput value={search} onChange={setSearch} label="Search patients" placeholder="Name or mobile number" />
          {patients.status === 'success' && (
            <p className="text-sm text-subtle tabular">{patients.data.filter(filter).length} of {patients.data.length} patients</p>
          )}
        </div>
        <QueryView
          query={patients}
          errorTitle="Could not load patients"
          isEmpty={(d) => d.length === 0}
          empty={
            <EmptyState
              icon={Users}
              title="No patients registered yet"
              description="Add a patient here or from the label workstation."
              action={<Button icon={UserPlus} onClick={() => setAdding(true)}>Add patient</Button>}
            />
          }
        >
          {(rows) => {
            const shown = rows.filter(filter);
            return shown.length === 0 ? (
              <EmptyState title="No patients match your search" description="Check the spelling or search by mobile number." />
            ) : (
              <DataTable caption="Patients" columns={columns} rows={shown} rowKey={(p) => p.id ?? p.phone_number} rowHref={(p) => (p.id ? `/admin/patients/${p.id}` : null)} />
            );
          }}
        </QueryView>
      </Card>
      <AddPatientDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={(p) => {
          setAdding(false);
          toast.success(`${p.name} was added to the patient register.`);
          patients.retry();
        }}
      />
    </PageBody>
  );
}

export default function PatientsPage() {
  return (
    <Suspense>
      <PatientsInner />
    </Suspense>
  );
}
