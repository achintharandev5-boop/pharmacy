'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Button, Dialog, EmptyState, ErrorState, FormField, Input, SkeletonRows } from '@/components/ui';
import { lookupPosCustomers, type PosCustomerMatch } from '@/app/actions/pos';
import { NETWORK_ERROR_MESSAGE } from '@/lib/api/types';
import { formatDate } from '@/lib/format';

/** The customer attached to the cart. Held in memory only, never in browser storage. */
export interface PosCustomer {
  id: string;
  name: string;
  phoneLast4: string;
}

/** Same minimum as the API (MIN_CUSTOMER_DIGITS), so the lookup cannot list patients. */
export const MIN_PHONE_DIGITS = 7;

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: PosCustomer | null) => void;
}

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: PosCustomerMatch[] };

export function maskedPhone(last4: string): string {
  return last4 ? `••• ${last4}` : 'No phone';
}

/**
 * Finds a registered patient by phone number. The POS sees only the name, the last four digits
 * and the registration date: no address, history or clinical details. A sale without a customer
 * is a walk-in sale. New patients are registered by pharmacy staff, not here.
 */
export function PosCustomerDialog({ open, onClose, onSelect }: Props) {
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<SearchState>({ status: 'idle' });
  const [hint, setHint] = useState<string | null>(null);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (digits.length < MIN_PHONE_DIGITS) {
      setHint(`Enter at least ${MIN_PHONE_DIGITS} digits of the phone number.`);
      return;
    }
    setHint(null);
    setState({ status: 'loading' });
    try {
      const res = await lookupPosCustomers(phone);
      setState(res.ok ? { status: 'success', data: res.data } : { status: 'error', message: res.error });
    } catch {
      setState({ status: 'error', message: NETWORK_ERROR_MESSAGE });
    }
  };

  const choose = (customer: PosCustomer | null) => {
    onSelect(customer);
    onClose();
  };

  const duplicateNames =
    state.status === 'success'
      ? new Set(state.data.map((c) => c.name.toLowerCase()).filter((n, i, all) => all.indexOf(n) !== i))
      : new Set<string>();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Customer"
      description="Find a registered patient by phone number, or continue as a walk-in sale."
      footer={
        <Button size="lg" onClick={() => choose(null)}>
          Walk-in customer
        </Button>
      }
    >
      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <FormField label="Phone number" error={hint} className="flex-1">
          {(field) => (
            <Input
              {...field}
              data-autofocus
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="07X XXX XXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-12 text-base"
            />
          )}
        </FormField>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          icon={Search}
          loading={state.status === 'loading'}
          className="sm:mt-6"
        >
          Search
        </Button>
      </form>
      <div className="mt-3 max-h-72 overflow-y-auto rounded-ui border border-border" aria-live="polite">
        {state.status === 'idle' && (
          <p className="p-4 text-sm text-subtle">Only name and the last four digits are shown. Patient records are not opened here.</p>
        )}
        {state.status === 'loading' && <SkeletonRows rows={3} label="Searching patients" />}
        {state.status === 'error' && <ErrorState compact message={state.message} onRetry={() => void search()} />}
        {state.status === 'success' && state.data.length === 0 && (
          <EmptyState
            title="No registered patient with this number"
            description="Continue as a walk-in sale. Pharmacy staff can register new patients."
          />
        )}
        {state.status === 'success' && state.data.length > 0 && (
          <ul className="divide-y divide-border" aria-label="Matching patients">
            {state.data.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => choose({ id: c.id, name: c.name, phoneLast4: c.phoneLast4 })}
                  className="flex min-h-14 w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 text-left hover:bg-surface focus-visible:bg-primary-soft focus-visible:outline-none"
                >
                  <span className="font-semibold text-fg">{c.name}</span>
                  <span className="text-sm text-muted">
                    <span className="font-mono">{maskedPhone(c.phoneLast4)}</span>
                    {(duplicateNames.has(c.name.toLowerCase()) || c.registeredOn) && (
                      <span className="text-subtle"> · registered {formatDate(c.registeredOn)}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {state.status === 'success' && duplicateNames.size > 0 && (
        <p className="mt-2 text-xs text-warning">More than one patient has the same name. Confirm with the customer before choosing.</p>
      )}
    </Dialog>
  );
}
