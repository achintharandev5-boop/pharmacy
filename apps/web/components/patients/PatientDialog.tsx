'use client';

import React, { useState } from 'react';
import {
  createNewPerson,
  findDuplicatePatients,
  updatePatient,
  type PatientUpdate,
  type PersonData,
  type PossibleDuplicate,
} from '@/app/actions/customers';
import { Alert, Button, Dialog, FormField, Input, Select, Textarea } from '@/components/ui';
import { formatDate } from '@/lib/format';

const PHONE_PATTERN = /^[+\d\s-]{7,20}$/;

export const ALLERGY_OPTIONS = [
  { value: 'UNKNOWN', label: 'Not recorded' },
  { value: 'NONE_KNOWN', label: 'No known allergies (confirmed with patient)' },
  { value: 'HAS_ALLERGIES', label: 'Has allergies' },
] as const;

const FIELDS = ['name', 'phone_number', 'age', 'gender', 'address', 'medical_notes', 'allergy_status', 'allergies'] as const;
type Field = (typeof FIELDS)[number];
type FormState = Record<Field, string>;

function fromPatient(p?: PersonData | null): FormState {
  const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  return {
    name: s(p?.name),
    phone_number: s(p?.phone_number),
    age: s(p?.age),
    gender: s(p?.gender),
    address: s(p?.address),
    medical_notes: s(p?.medical_notes),
    allergy_status: s(p?.allergy_status) || 'UNKNOWN',
    allergies: s(p?.allergies),
  };
}

/** The allergy list only applies while the status is "Has allergies"; otherwise it is not kept. */
function normalised(form: FormState): FormState {
  const trimmed = Object.fromEntries(FIELDS.map((k) => [k, form[k].trim()])) as FormState;
  if (trimmed.allergy_status !== 'HAS_ALLERGIES') trimmed.allergies = '';
  return trimmed;
}

export function validatePatient(form: FormState): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  if (!form.name.trim()) errors.name = 'Enter the patient’s name.';
  if (!PHONE_PATTERN.test(form.phone_number.trim())) errors.phone_number = 'Enter a phone number (digits, spaces, + or -).';
  if (form.allergy_status === 'HAS_ALLERGIES' && !form.allergies.trim()) errors.allergies = 'List the allergies.';
  return errors;
}

/** The changed fields only, so an edit never rewrites values it did not touch. */
export function patientChanges(initial: FormState, form: FormState): PatientUpdate {
  const before = normalised(initial);
  const after = normalised(form);
  const changes: Record<string, string> = {};
  for (const k of FIELDS) if (after[k] !== before[k]) changes[k] = after[k];
  return changes as PatientUpdate;
}

type DuplicateCheck =
  | { state: 'idle' }
  | { state: 'found'; phone: string; matches: PossibleDuplicate[] }
  | { state: 'failed'; phone: string; error: string };

interface PatientDialogProps {
  open: boolean;
  /** Omit to register a new patient; pass the record to edit it. */
  patient?: PersonData | null;
  onClose: () => void;
  onSaved: (patient: PersonData) => void;
}

/**
 * Register or edit a patient. Before saving a new mobile number the register is checked for
 * patients already using it. Families often share a number, so a match is shown as a warning
 * the user can accept, never as a refusal.
 */
export function PatientDialog({ open, patient, onClose, onSaved }: PatientDialogProps) {
  const editing = Boolean(patient?.id);
  const [initial, setInitial] = useState(() => fromPatient(patient));
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateCheck>({ state: 'idle' });

  // Re-seed the form whenever the dialog opens for a (possibly different) patient.
  const [seededFor, setSeededFor] = useState<{ open: boolean; patient?: PersonData | null }>({ open, patient });
  if (seededFor.open !== open || seededFor.patient !== patient) {
    setSeededFor({ open, patient });
    if (open) {
      const next = fromPatient(patient);
      setInitial(next);
      setForm(next);
      setErrors({});
      setSaveError(null);
      setDuplicates({ state: 'idle' });
    }
  }

  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
    if (k === 'phone_number') setDuplicates({ state: 'idle' });
  };

  const close = () => {
    if (saving) return;
    onClose();
  };

  const phone = form.phone_number.trim();
  const phoneChanged = !editing || phone !== initial.phone_number.trim();
  const warned = duplicates.state !== 'idle' && duplicates.phone === phone;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = validatePatient(form);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaveError(null);

    const changes = editing ? patientChanges(initial, form) : null;
    if (changes && Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    if (phoneChanged && !warned) {
      const check = await findDuplicatePatients(phone, patient?.id);
      if (!check.ok) {
        setSaving(false);
        setDuplicates({ state: 'failed', phone, error: check.error });
        return;
      }
      if (check.data.length > 0) {
        setSaving(false);
        setDuplicates({ state: 'found', phone, matches: check.data });
        return;
      }
    }

    let res: { success: boolean; data?: PersonData; error?: string };
    if (editing && changes) {
      res = await updatePatient(patient!.id!, changes);
    } else {
      const values = normalised(form);
      const payload: Record<string, string> = {};
      for (const k of FIELDS) if (values[k] && !(k === 'allergy_status' && values[k] === 'UNKNOWN')) payload[k] = values[k];
      res = await createNewPerson(payload as unknown as PersonData);
    }
    setSaving(false);
    if (!res.success || !res.data) {
      setSaveError(res.error ?? (editing ? 'The changes were not saved.' : 'The patient was not saved.'));
      return;
    }
    onSaved(res.data);
  };

  const submitLabel = !warned
    ? editing
      ? 'Save changes'
      : 'Save patient'
    : duplicates.state === 'failed'
      ? 'Save without checking'
      : editing
        ? 'Save anyway'
        : 'Register as a new patient';

  const clearsAllergies = editing && initial.allergies.trim() !== '' && form.allergy_status !== 'HAS_ALLERGIES';

  return (
    <Dialog
      open={open}
      onClose={close}
      busy={saving}
      title={editing ? 'Edit patient' : 'Add patient'}
      description={
        editing
          ? 'Prescriptions already printed keep the name and details they were printed with.'
          : 'Saved to the patient register. Required fields are marked *.'
      }
      size="lg"
      footer={
        <>
          <Button onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="patient-form" variant="primary" loading={saving}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id="patient-form" onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {saveError && (
          <Alert className="sm:col-span-2" title={editing ? 'Changes not saved' : 'Patient not saved'}>
            {saveError}
          </Alert>
        )}
        {warned && duplicates.state === 'found' && (
          <Alert tone="warning" className="sm:col-span-2" title={duplicates.matches.length === 1 ? 'A patient already uses this number' : `${duplicates.matches.length} patients already use this number`}>
            <ul className="mt-1 space-y-1">
              {duplicates.matches.map((m) => (
                <li key={m.id}>
                  <a href={`/admin/patients/${m.id}`} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">
                    {m.name}
                  </a>{' '}
                  <span className="tabular text-subtle">
                    {m.phone_number}
                    {m.created_at ? ` · registered ${formatDate(m.created_at)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2">
              If this is the same person, cancel and use the existing record. Family members can share a number: check the name, then
              save.
            </p>
          </Alert>
        )}
        {warned && duplicates.state === 'failed' && (
          <Alert tone="warning" className="sm:col-span-2" title="Could not check for patients with this number">
            {duplicates.error} You can try again later or save without the check.
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
              {form.gender && !['Female', 'Male', 'Other'].includes(form.gender) && <option value={form.gender}>{form.gender}</option>}
            </Select>
          )}
        </FormField>
        <FormField label="Address" className="sm:col-span-2">
          {(f) => <Input {...f} value={form.address} onChange={set('address')} />}
        </FormField>
        <FormField
          label="Allergy status"
          hint={clearsAllergies ? 'The recorded allergy list will be removed when you save.' : 'Leave as “Not recorded” unless you have asked the patient.'}
          className="sm:col-span-2"
        >
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
