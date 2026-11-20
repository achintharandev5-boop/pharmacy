import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientDialog, patientChanges, validatePatient } from './PatientDialog';
import { createNewPerson, findDuplicatePatients, updatePatient } from '../../app/actions/customers';

vi.mock('../../app/actions/customers', () => ({ createNewPerson: vi.fn(), updatePatient: vi.fn(), findDuplicatePatients: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

const ID = '44444444-4444-4444-8444-444444444444';
const existing = {
  id: ID,
  name: 'Nimal Perera',
  phone_number: '0771234567',
  address: 'Colombo',
  allergy_status: 'HAS_ALLERGIES' as const,
  allergies: 'Penicillin',
};

function fillNew(name = 'Kamala Perera', phone = '0771234567') {
  fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: phone } });
}

describe('patient form rules', () => {
  const form = { name: 'A', phone_number: '0771234567', age: '', gender: '', address: '', medical_notes: '', allergy_status: 'UNKNOWN', allergies: '' };

  it('requires a name, a phone number and an allergy list when the patient has allergies', () => {
    expect(validatePatient(form)).toEqual({});
    expect(validatePatient({ ...form, name: '  ', phone_number: 'x' })).toEqual({ name: expect.any(String), phone_number: expect.any(String) });
    expect(validatePatient({ ...form, allergy_status: 'HAS_ALLERGIES' })).toEqual({ allergies: expect.any(String) });
  });

  it('sends only changed fields, trimmed, and drops the allergy list when the status no longer has allergies', () => {
    const before = { ...form, allergy_status: 'HAS_ALLERGIES', allergies: 'Sulfa' };
    expect(patientChanges(before, { ...before, address: ' Kandy ' })).toEqual({ address: 'Kandy' });
    expect(patientChanges(before, { ...before, allergy_status: 'NONE_KNOWN' })).toEqual({ allergy_status: 'NONE_KNOWN', allergies: '' });
    expect(patientChanges(before, before)).toEqual({});
  });
});

describe('registering a patient', () => {
  it('saves when no one else uses the number', async () => {
    vi.mocked(findDuplicatePatients).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(createNewPerson).mockResolvedValue({ success: true, data: { id: 'new', name: 'Kamala Perera', phone_number: '0771234567' } });
    const onSaved = vi.fn();
    render(<PatientDialog open onClose={vi.fn()} onSaved={onSaved} />);
    fillNew();
    fireEvent.click(screen.getByRole('button', { name: 'Save patient' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(findDuplicatePatients).toHaveBeenCalledWith('0771234567', undefined);
    // "Not recorded" is the database default, so it is not sent.
    expect(createNewPerson).toHaveBeenCalledWith({ name: 'Kamala Perera', phone_number: '0771234567' });
  });

  it('warns about patients with the same number and saves only after the user confirms', async () => {
    vi.mocked(findDuplicatePatients).mockResolvedValue({
      ok: true,
      data: [{ id: ID, name: 'Nimal Perera', phone_number: '077 123 4567', created_at: '2026-01-02T00:00:00Z' }],
    });
    vi.mocked(createNewPerson).mockResolvedValue({ success: true, data: { id: 'new', name: 'Kamala Perera', phone_number: '0771234567' } });
    const onSaved = vi.fn();
    render(<PatientDialog open onClose={vi.fn()} onSaved={onSaved} />);
    fillNew();
    fireEvent.click(screen.getByRole('button', { name: 'Save patient' }));

    expect(await screen.findByText('A patient already uses this number')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nimal Perera' })).toHaveAttribute('href', `/admin/patients/${ID}`);
    expect(createNewPerson).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Register as a new patient' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(findDuplicatePatients).toHaveBeenCalledTimes(1);
  });

  it('checks again after the number is changed', async () => {
    vi.mocked(findDuplicatePatients).mockResolvedValue({ ok: true, data: [{ id: ID, name: 'Nimal Perera', phone_number: '0771234567' }] });
    render(<PatientDialog open onClose={vi.fn()} onSaved={vi.fn()} />);
    fillNew();
    fireEvent.click(screen.getByRole('button', { name: 'Save patient' }));
    await screen.findByRole('button', { name: 'Register as a new patient' });
    fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: '0719999999' } });
    expect(screen.getByRole('button', { name: 'Save patient' })).toBeInTheDocument();
    expect(screen.queryByText(/already uses? this number/)).not.toBeInTheDocument();
  });

  it('shows a failed duplicate check and lets the user save without it', async () => {
    vi.mocked(findDuplicatePatients).mockResolvedValue({ ok: false, error: 'The pharmacy server is unreachable.' });
    vi.mocked(createNewPerson).mockResolvedValue({ success: true, data: { id: 'new', name: 'Kamala Perera', phone_number: '0771234567' } });
    const onSaved = vi.fn();
    render(<PatientDialog open onClose={vi.fn()} onSaved={onSaved} />);
    fillNew();
    fireEvent.click(screen.getByRole('button', { name: 'Save patient' }));
    expect(await screen.findByText('Could not check for patients with this number')).toBeInTheDocument();
    expect(createNewPerson).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save without checking' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('shows a failed save and keeps the form', async () => {
    vi.mocked(findDuplicatePatients).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(createNewPerson).mockResolvedValue({ success: false, error: 'The database did not respond.' });
    const onSaved = vi.fn();
    render(<PatientDialog open onClose={vi.fn()} onSaved={onSaved} />);
    fillNew();
    fireEvent.click(screen.getByRole('button', { name: 'Save patient' }));
    expect(await screen.findByText('The database did not respond.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toHaveValue('Kamala Perera');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('does not call the server when the form is invalid', () => {
    render(<PatientDialog open onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save patient' }));
    expect(screen.getByText('Enter the patient’s name.')).toBeInTheDocument();
    expect(findDuplicatePatients).not.toHaveBeenCalled();
    expect(createNewPerson).not.toHaveBeenCalled();
  });
});

describe('editing a patient', () => {
  it('opens with the recorded details and sends only what changed, without a duplicate check', async () => {
    vi.mocked(updatePatient).mockResolvedValue({ success: true, data: { ...existing, address: 'Kandy' } });
    const onSaved = vi.fn();
    render(<PatientDialog open patient={existing} onClose={vi.fn()} onSaved={onSaved} />);
    expect(screen.getByLabelText(/Full name/)).toHaveValue('Nimal Perera');
    expect(screen.getByLabelText(/Allergies/)).toHaveValue('Penicillin');
    fireEvent.change(screen.getByLabelText(/Address/), { target: { value: 'Kandy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(updatePatient).toHaveBeenCalledWith(ID, { address: 'Kandy' });
    expect(findDuplicatePatients).not.toHaveBeenCalled();
  });

  it('checks a changed number against other patients only', async () => {
    vi.mocked(findDuplicatePatients).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(updatePatient).mockResolvedValue({ success: true, data: { ...existing, phone_number: '0719999999' } });
    render(<PatientDialog open patient={existing} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: '0719999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(updatePatient).toHaveBeenCalledWith(ID, { phone_number: '0719999999' }));
    expect(findDuplicatePatients).toHaveBeenCalledWith('0719999999', ID);
  });

  it('says the allergy list will be removed when the status changes', () => {
    render(<PatientDialog open patient={existing} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Allergy status/), { target: { value: 'NONE_KNOWN' } });
    expect(screen.getByText('The recorded allergy list will be removed when you save.')).toBeInTheDocument();
  });

  it('closes without saving when nothing changed', () => {
    const onClose = vi.fn();
    render(<PatientDialog open patient={existing} onClose={onClose} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onClose).toHaveBeenCalled();
    expect(updatePatient).not.toHaveBeenCalled();
  });

  it('keeps a recorded gender that is not in the list', () => {
    render(<PatientDialog open patient={{ ...existing, gender: 'F' }} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByLabelText(/Gender/)).toHaveValue('F');
  });
});
