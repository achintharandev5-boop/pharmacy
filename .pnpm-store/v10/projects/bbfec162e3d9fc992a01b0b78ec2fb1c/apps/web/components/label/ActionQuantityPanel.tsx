'use client';

import React, { useState } from 'react';
import { CalendarCheck, Clock, RefreshCcw, Stethoscope, Sunset, type LucideIcon } from 'lucide-react';
import { useLabelStore, parseQty, type ActiveControl } from '../../store/labelStore';
import { QUANTITY_CODES } from '../../lib/instructionEngine';
import { dosageRatio, dosageText, stepDosage } from '../../lib/dosageQuantity';
import { CompactQuantityEditor } from './CompactQuantityEditor';

/** Number-pad targets whose quantity is now entered with the compact editor instead of the pad. */
export const COMPACT_QUANTITY_TARGETS: ActiveControl[] = ['frequency', 'frequency_fraction', 'weekly', 'weekly_fraction'];

type Quantity = { qty: number; isFraction: boolean };

/** The quantity in the number pad's own notation ("2", "1/2", "1 1/2"), parsed back by parseQty. */
export function quantityEntry({ qty, isFraction }: Quantity): string {
  if (!isFraction) return String(qty);
  const [n, d] = dosageRatio(qty);
  const whole = Math.floor(n / d);
  const remainder = n % d;
  if (!remainder) return String(whole);
  return whole ? `${whole} ${remainder}/${d}` : `${remainder}/${d}`;
}

const HEADERS: Record<string, { title: string; description: string; icon: LucideIcon; iconClass: string }> = {
  '5H': { title: '5H', description: 'Quantity for each dose, every 5 hours', icon: Clock, iconClass: 'bg-primary-soft border-primary-border text-primary' },
  '6H': { title: '6H', description: 'Quantity for each dose, every 6 hours', icon: Clock, iconClass: 'bg-primary-soft border-primary-border text-primary' },
  '8H': { title: '8H', description: 'Quantity for each dose, every 8 hours', icon: Clock, iconClass: 'bg-primary-soft border-primary-border text-primary' },
  DAILY: { title: 'Daily', description: 'Quantity for the daily dose', icon: CalendarCheck, iconClass: 'bg-green-soft border-green-border text-green-strong' },
  EVENING: { title: 'Evening', description: 'Quantity for the evening dose', icon: Sunset, iconClass: 'bg-amber-soft border-amber-border text-amber-strong' },
  '4H': { title: 'ENT 4H', description: 'Quantity for each ENT dose', icon: Stethoscope, iconClass: 'bg-primary-soft border-primary-border text-primary' },
  CUSTOM: { title: 'ENT custom hours', description: 'Quantity for each ENT dose', icon: Stethoscope, iconClass: 'bg-primary-soft border-primary-border text-primary' },
  WEEKLY: { title: 'Weekly', description: 'Quantity for the weekly dose', icon: RefreshCcw, iconClass: 'bg-teal-soft border-teal-border text-teal-strong' },
};

/**
 * Quantity step of 5H / 6H / 8H, Daily, Evening, ENT custom hours and Weekly, in the compact
 * editor. The value is a draft until Done (Next), which applies it through the number pad's
 * existing validation and assignment (validateQtyEntry, applyQty); Cancel changes nothing.
 * Each action's own next step (e.g. "Done - Weekly") is unchanged.
 */
export function ActionQuantityPanel() {
  const target = useLabelStore((state) => state.numberPad.targetControl);
  const storeError = useLabelStore((state) => state.numberPad.error);
  const instructions = useLabelStore((state) => state.additionalInstructions);
  const weekly = target === 'weekly' || target === 'weekly_fraction';
  const current = useLabelStore((state) => (weekly ? state.weeklyDosage : state.frequencyDosage));
  const [draft, setDraft] = useState<Quantity>(() => ({ qty: current?.qty ?? 0, isFraction: current?.isFraction ?? false }));

  const code = weekly ? 'WEEKLY' : instructions.find((i) => QUANTITY_CODES.includes(i)) ?? '';
  const header = HEADERS[code] ?? { title: 'Quantity', description: 'Quantity for each dose', icon: Clock, iconClass: 'bg-primary-soft border-primary-border text-primary' };
  const valid = Number.isFinite(draft.qty) && draft.qty > 0;

  const fraction = (value: string) => {
    const whole = Math.floor(Number.isFinite(draft.qty) ? draft.qty : 0);
    if (value === 'clear') { setDraft({ qty: whole, isFraction: false }); return; }
    // Same as the pad's X/Y: the fraction is added to the whole number already chosen.
    const part = parseQty(value);
    setDraft({ qty: whole + part.qty, isFraction: true });
  };

  const confirm = () => {
    const store = useLabelStore.getState();
    const base = (target ?? '').replace('_fraction', '') as ActiveControl;
    if (target !== base) { store.cancelNumberPad(); store.openNumberPad(base); }
    store.clearNumberPadBuffer();
    store.appendDigit(quantityEntry(draft));
    store.confirmNumberPad();
  };

  return (
    <CompactQuantityEditor
      icon={header.icon}
      iconClass={header.iconClass}
      title={header.title}
      description={header.description}
      quantityLabel={weekly ? 'Weekly quantity' : 'Quantity per dose'}
      display={valid ? dosageText(draft.qty, draft.isFraction) : '0'}
      hasQuantity={valid}
      hint="Enter the quantity to continue"
      error={storeError}
      ariaName={header.title}
      testId="action-qty"
      fractionTarget={weekly ? 'weekly_fraction' : 'frequency_fraction'}
      initialFractionOpen={Boolean(target?.endsWith('_fraction'))}
      onIncrement={() => setDraft((d) => stepDosage(Number.isFinite(d.qty) ? d.qty : 0, 1))}
      onDecrement={() => setDraft((d) => stepDosage(Number.isFinite(d.qty) ? d.qty : 0, -1))}
      onFraction={fraction}
      onCancel={() => useLabelStore.getState().cancelNumberPad()}
      onConfirm={confirm}
    />
  );
}
