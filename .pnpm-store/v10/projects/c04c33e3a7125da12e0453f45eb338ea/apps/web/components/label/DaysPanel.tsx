'use client';

import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { useLabelStore } from '../../store/labelStore';
import { CompactQuantityEditor } from './CompactQuantityEditor';

/**
 * Days (number of days), opened from the Days action button. Same rules as the former bottom
 * Days card: + from "not set" gives 1, − never goes below 1, and tapping the number opens the
 * existing Days number pad for typed entry. The value is a draft until Done, which applies it
 * through the pad's existing validation (whole days only); Cancel changes nothing.
 */
export function DaysPanel() {
  const current = useLabelStore((state) => state.days);
  const storeError = useLabelStore((state) => state.numberPad.error);
  const [draft, setDraft] = useState<number | null>(current);
  const hasDays = draft != null && draft > 0;

  const close = () => useLabelStore.getState().setActiveControl('idle');
  const confirm = () => {
    if (draft === current) { close(); return; }
    const store = useLabelStore.getState();
    store.openNumberPad('days');
    store.clearNumberPadBuffer();
    store.appendDigit(String(draft ?? 0));
    store.confirmNumberPad();
  };

  return (
    <CompactQuantityEditor
      icon={Calendar}
      iconClass="bg-purple-soft border-purple-border text-purple-strong"
      title="Days"
      description="Number of days the medicine is taken"
      quantityLabel="Number of days"
      display={hasDays ? String(draft) : '—'}
      hasQuantity={hasDays}
      hint="No duration is printed until days are entered"
      error={storeError}
      ariaName="days"
      testId="days-qty"
      fractionTarget="days"
      onEditValue={() => useLabelStore.getState().openNumberPad('days')}
      editValueLabel={`Days: ${hasDays ? draft : 'not set'}. Type the number of days`}
      canDecrease={hasDays && draft! > 1}
      canConfirm
      confirmLabel="Done"
      onIncrement={() => setDraft((d) => (d ?? 0) + 1)}
      onDecrement={() => setDraft((d) => (d == null ? null : Math.max(1, d - 1)))}
      onCancel={close}
      onConfirm={confirm}
    />
  );
}
