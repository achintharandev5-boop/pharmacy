'use client';

import { reasonSelectionRefusal } from '../../lib/reasons';
import { dosageText, fractionText } from '../../lib/dosageQuantity';
import { daySelectionRefusal } from '../../lib/nameOfDays';
import { weeklySelectionRefusal } from '../../lib/weeklyPolicy';
import { dailySelectionRefusal } from '../../lib/dailyPolicy';
import { eveningSelectionRefusal } from '../../lib/eveningPolicy';
import { digitalSelectionRefusal } from '../../lib/digitalSchedule';
import { intervalSelectionRefusal } from '../../lib/intervalPolicy';
import { statSelectionRefusal } from '../../lib/statPolicy';
import { eodSelectionRefusal } from '../../lib/eod';
import React from 'react';
import { useLabelStore, parseQty, validateQtyEntry, isStatStep } from '../../store/labelStore';
import { ReasonsPanel } from '../../app/label/ReasonsPanel';
import { STAT_LOCK_HINT } from './InstructionTile';
import { DOSE_MINUS_DISABLED, DOSE_MINUS_PRESSED, DOSE_MINUS_TONE, DOSE_XY_IDLE, PLUS_PRESSED, PLUS_TONE, STEP_DISABLED, XY_SELECTED } from './buttonVariants';
import { ChevronDown, Minus, Plus, Lock } from 'lucide-react';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';
/** X/Y, − and +: fill their grid cell's width, and the row's height up to a cap, never below --dose-ctl. */
const DOSE_CTL = 'w-full h-full min-h-(--dose-ctl) max-h-[10rem]';
/** Pressed and hover feedback for the dose controls (no motion under prefers-reduced-motion). */
const DOSE_MOTION = 'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out';

export function formatDisplayQty(qty: number, isFraction: boolean): string {
  return dosageText(qty, isFraction);
}

export function formatFractionPart(qty: number, isFraction: boolean): string | null {
  return isFraction ? fractionText(qty) : null;
}

interface DosageRowProps {
  labelTitle: string;
  timeRange: string;
  icon: React.ReactNode;
  bgClass: string;
  borderClass: string;
  /** Time-of-day colour of the card's edge while it has no dose. */
  stripeClass: string;
  /** Time-of-day tint of the card while it has no dose. */
  cardClass: string;
  qtyValue: number;
  isFraction: boolean;
  isActive: boolean;
  fractionPreview?: string;
  onOpenQtyPad: () => void;
  onOpenXYPad: () => void;
  onDecrement: () => void;
  onIncrement: () => void;
}

function DosageRowCard({
  labelTitle,
  timeRange,
  icon,
  bgClass,
  borderClass,
  stripeClass,
  cardClass,
  qtyValue,
  isFraction,
  isActive,
  fractionPreview,
  onOpenQtyPad,
  onOpenXYPad,
  onDecrement,
  onIncrement,
}: DosageRowProps) {
  const [selectedStep, setSelectedStep] = React.useState<'plus' | 'minus' | null>(null);
  const displayQty = formatDisplayQty(qtyValue, isFraction);
  const fractionPart = fractionPreview || formatFractionPart(qtyValue, isFraction);
  const title = labelTitle.charAt(0) + labelTitle.slice(1).toLowerCase();

  const selected = qtyValue > 0;

  return (
    <div
      role="group"
      aria-label={`${title} dose`}
      data-active={isActive || undefined}
      data-selected={selected || undefined}
      className={`relative w-full flex-1 min-h-0 rounded-ui-lg border p-1.5 pl-3.5 xl:pl-4 grid grid-cols-1 lg:grid-cols-2 items-center gap-2 xl:gap-2.5 backdrop-blur-md shadow-[inset_0_1px_0_var(--glass-highlight),0_1px_2px_rgb(23_21_43/0.04)] ${DOSE_MOTION} ${
        selected ? 'bg-primary-soft/40 border-primary' : `${cardClass} hover:border-[var(--glass-border-strong)]`
      } ${isActive ? 'ring-2 ring-primary ring-offset-1' : ''}`}
    >
      {/* Edge: the time-of-day colour while empty; a wider blue accent bar once it has a dose
          (shape as well as colour). */}
      {selected
        ? <span aria-hidden="true" data-testid={`${labelTitle.toLowerCase()}-accent`} className="absolute left-0 top-0 bottom-0 w-2 rounded-l-ui-lg bg-primary" />
        : <span aria-hidden="true" className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-ui-lg ${stripeClass}`} />}

      {/* Announces the new quantity after − / + or the pad (live regions speak on change only). */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">{`${title} quantity ${displayQty}`}</span>

      {/* 1. TIME + QTY: tapping opens the number pad for this row */}
      <button
        type="button"
        onClick={onOpenQtyPad}
        aria-label={`${title} quantity: ${displayQty}. Enter quantity`}
        aria-pressed={selected}
        className={`flex min-w-0 items-center gap-2 xl:gap-3 self-stretch select-none cursor-pointer rounded-ui-lg text-left px-1.5 ${DOSE_MOTION} hover:bg-[var(--glass-surface-strong)] ${FOCUS_RING}`}
      >
        {/* Time-of-day icon on its own soft accent tile */}
        <span className={`shrink-0 w-11 h-11 xl:w-14 xl:h-14 rounded-ui-lg border flex lg:hidden xl:flex items-center justify-center ${bgClass} ${borderClass}`} aria-hidden="true">
          {icon}
        </span>
        <span className="flex flex-col justify-center min-w-0 flex-1">
          <span className="font-black text-base xl:text-lg text-fg tracking-wide leading-tight truncate">
            {labelTitle}
          </span>
          <span className="text-xs xl:text-sm text-muted font-semibold leading-none mt-1.5 whitespace-nowrap tabular">
            {timeRange}
          </span>
          {/* Text cue for the selected state (no checkmark) */}
          {selected && (
            <span data-testid={`${labelTitle.toLowerCase()}-selected`} className="text-[10px] font-bold uppercase tracking-wider text-primary leading-tight mt-0.5">
              Active
            </span>
          )}
        </span>
        <span
          className={`flex flex-col items-center justify-center shrink-0 min-w-[4.5rem] xl:min-w-[5.5rem] self-center rounded-ui-lg border px-2 py-1.5 ${
            selected ? 'bg-primary-soft border-primary-border' : 'bg-[var(--glass-surface-strong)] border-[var(--glass-border)]'
          }`}
        >
          <span className="text-[10px] font-bold text-subtle uppercase tracking-wider leading-none" aria-hidden="true">Qty</span>
          <span
            data-testid={`${labelTitle.toLowerCase()}-qty`}
            className={`font-black text-3xl xl:text-4xl 2xl:text-5xl text-center leading-none mt-1 whitespace-nowrap tabular ${
              selected ? 'text-primary' : 'text-muted'
            }`}
          >
            {/* Inner span re-mounts on change for a short ease-in; the outer element stays stable. */}
            <span key={displayQty} className="dose-tick inline-block">{displayQty}</span>
          </span>
        </span>
      </button>

      {/* X/Y, − and + share the other half of the row: X/Y a little wider, all the same height. */}
      <div className="self-stretch min-w-0 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 xl:gap-2.5">
        {/* 2. X / Y FRACTION */}
        <button
          type="button"
          onClick={onOpenXYPad}
          aria-label={`${title} fraction: ${fractionPart ?? 'none'}. Choose fraction`}
          aria-pressed={isActive || !!fractionPart}
          className={`${DOSE_CTL} border-2 rounded-ui-lg flex flex-col items-center justify-center px-2 shadow-2xs backdrop-blur-sm cursor-pointer select-none touch-manipulation active:scale-95 active:bg-purple-soft ${DOSE_MOTION} ${FOCUS_RING} ${
            isActive || fractionPart ? XY_SELECTED : DOSE_XY_IDLE
          }`}
        >
          <span className="text-xs font-bold text-subtle uppercase tracking-wider leading-none" aria-hidden="true">X / Y</span>
          <span className="flex items-center gap-1.5 text-3xl xl:text-4xl 2xl:text-5xl font-black leading-tight mt-0.5">
            <span className="whitespace-nowrap">{fractionPart ?? '—'}</span>
            <span className="flex h-7 w-7 xl:h-8 xl:w-8 shrink-0 items-center justify-center rounded-full border border-[var(--glass-border-strong)] bg-[var(--glass-surface-strong)]" aria-hidden="true">
              <ChevronDown className="w-5 h-5 xl:w-6 xl:h-6 text-purple" strokeWidth={3} />
            </span>
          </span>
        </button>

        {/* 3. MINUS: solid red, same size as plus; muted red with a dashed edge when disabled */}
        <button
          type="button"
          onClick={() => { setSelectedStep('minus'); onDecrement(); }}
          aria-pressed={selectedStep === 'minus'}
          disabled={qtyValue <= 0}
          aria-label={`Decrease ${labelTitle} dosage`}
          className={`${DOSE_CTL} rounded-ui-lg border-2 ${DOSE_MINUS_TONE} flex items-center justify-center shadow-sm select-none touch-manipulation cursor-pointer active:scale-95 ${DOSE_MOTION} ${DOSE_MINUS_DISABLED} ${FOCUS_RING} ${
            // The last-pressed ring is not drawn on a disabled − (it would read as an error edge).
            selectedStep === 'minus' && qtyValue > 0 ? DOSE_MINUS_PRESSED : ''
          }`}
        >
          <Minus className="w-10 h-10 2xl:w-12 2xl:h-12" strokeWidth={3.5} aria-hidden="true" />
        </button>

        {/* 4. PLUS: solid green, the positive step */}
        <button
          type="button"
          onClick={() => { setSelectedStep('plus'); onIncrement(); }}
          aria-pressed={selectedStep === 'plus'}
          aria-label={`Increase ${labelTitle} dosage`}
          className={`${DOSE_CTL} rounded-ui-lg border-2 border-transparent ${PLUS_TONE} flex items-center justify-center shadow-sm ${DOSE_MOTION} select-none touch-manipulation cursor-pointer active:scale-95 ${STEP_DISABLED} ${FOCUS_RING} ${
            selectedStep === 'plus' ? PLUS_PRESSED : ''
          }`}
        >
          <Plus className="w-10 h-10 2xl:w-12 2xl:h-12" strokeWidth={3.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function DosagePanel({ only }: { only?: 'morning' | 'lunch' | 'night' } = {}) {
  const activeLabel = useLabelStore((state) => state.labels[state.activeLabelIndex]);
  const activeControl = useLabelStore((state) => state.activeControl);
  const dosage = useLabelStore((state) => state.dosage);
  const numberPad = useLabelStore((state) => state.numberPad);

  const openNumberPad = useLabelStore((state) => state.openNumberPad);
  const incrementDosage = useLabelStore((state) => state.incrementDosage);
  const decrementDosage = useLabelStore((state) => state.decrementDosage);

  if (activeControl === 'reasons') {
    return <ReasonsPanel />;
  }

  const times = [
    {
      key: 'morning' as const,
      title: 'MORNING',
      timeRange: '06:00 - 11:00',
      fractionKey: 'morning_fraction' as const,
      bgClass: 'bg-[var(--glass-surface-strong)]',
      borderClass: 'border-[var(--glass-border)]',
      stripeClass: 'bg-[var(--glass-border-strong)]',
      cardClass: 'bg-[var(--glass-surface)] border-[var(--glass-border)]',
      icon: (
        <svg className="w-7 h-7 xl:w-8 xl:h-8 text-[var(--glass-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4.5" fill="var(--glass-surface-strong)" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ),
    },
    {
      key: 'lunch' as const,
      title: 'LUNCH',
      timeRange: '11:00 - 16:00',
      fractionKey: 'lunch_fraction' as const,
      bgClass: 'bg-[var(--glass-surface-strong)]',
      borderClass: 'border-[var(--glass-border)]',
      stripeClass: 'bg-[var(--glass-border-strong)]',
      cardClass: 'bg-[var(--glass-surface)] border-[var(--glass-border)]',
      icon: (
        <svg className="w-7 h-7 xl:w-8 xl:h-8 text-[var(--glass-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" fill="var(--glass-surface-strong)" />
          <path d="M12 1v2" />
          <path d="M12 21v2" />
          <path d="M4.22 4.22l1.42 1.42" />
          <path d="M18.36 18.36l1.42 1.42" />
          <path d="M1 12h2" />
          <path d="M21 12h2" />
          <path d="M4.22 19.78l1.42-1.42" />
          <path d="M18.36 5.64l1.42-1.42" />
        </svg>
      ),
    },
    {
      key: 'night' as const,
      title: 'NIGHT',
      timeRange: '16:00 - 22:00',
      fractionKey: 'night_fraction' as const,
      bgClass: 'bg-[var(--glass-surface-strong)]',
      borderClass: 'border-[var(--glass-border)]',
      stripeClass: 'bg-[var(--glass-border-strong)]',
      cardClass: 'bg-[var(--glass-surface)] border-[var(--glass-border)]',
      icon: (
        <svg className="w-7 h-7 xl:w-8 xl:h-8 text-[var(--glass-accent)]" viewBox="0 0 24 24" fill="var(--glass-surface-strong)" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      ),
    },
  ];

  const editing = times.find((t) => activeControl === t.key || activeControl === t.fractionKey);
  // Why Morning/Lunch/Night are locked: the same refusal chain that disables them, shown and announced.
  const lockReason = isStatStep(activeControl)
    ? STAT_LOCK_HINT
    : reasonSelectionRefusal(activeLabel, 'DIGITAL') ?? daySelectionRefusal(activeLabel, 'DIGITAL') ?? weeklySelectionRefusal(activeLabel, 'DIGITAL') ?? dailySelectionRefusal(activeLabel, 'DIGITAL') ?? eveningSelectionRefusal(activeLabel, 'DIGITAL') ?? digitalSelectionRefusal(activeLabel, 'DIGITAL') ?? intervalSelectionRefusal(activeLabel, 'DIGITAL') ?? statSelectionRefusal(activeLabel, 'DIGITAL') ?? eodSelectionRefusal(activeLabel, 'DIGITAL');

  return (
    // --dose-ctl: the dosage −, + and X/Y size, deliberately larger than the shared --ws-ctl.
    <section aria-label="Dosage schedule" className={`glass-dose-panel w-full border border-[var(--glass-border)] rounded-ui-lg p-2 shadow-card flex flex-col [--dose-ctl:4.25rem] lg:[--dose-ctl:clamp(3.5rem,9.5dvh,5.25rem)] ${only ? 'shrink-0' : 'h-full flex-1 min-h-0'}`}>
      {/* No heading: only the Editing chip, while a row is being edited. */}
      {editing && (
        <div className="shrink-0 flex justify-end mb-2">
          <p className="text-xs font-bold text-primary bg-primary-soft border border-primary-border rounded-full px-2.5 py-1">
            Editing {editing.title.charAt(0) + editing.title.slice(1).toLowerCase()}
            {activeControl === editing.fractionKey ? ' fraction' : ''}
          </p>
        </div>
      )}

      {/* Locked: say why above the rows, not by fading alone (announced when it changes). */}
      <div role="status" aria-live="polite" className={lockReason ? 'shrink-0 mb-2' : 'sr-only'}>
        {lockReason && (
          <p id="dosage-lock-reason" data-testid="dosage-lock-reason" className="flex items-start gap-1.5 rounded-ui-lg border border-warning-border bg-warning-soft px-2.5 py-1.5 text-xs font-semibold text-warning">
            <Lock size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>Morning, Lunch and Night are locked: {lockReason}</span>
          </p>
        )}
      </div>

      {/* 3 Dosage Rows */}
      <fieldset disabled={Boolean(lockReason)} aria-describedby={lockReason ? 'dosage-lock-reason' : undefined} className="flex-1 flex flex-col gap-2 min-h-0 min-w-0 border-0 p-0 m-0 disabled:opacity-40">
        {times.filter((t) => !only || t.key === only).map((t) => {
          const entry = dosage[t.key];
          const isActive = activeControl === t.key || activeControl === t.fractionKey;
          const pending = numberPad.visible && numberPad.targetControl === t.fractionKey ? numberPad.buffer : '';
          const previewQty = pending && !validateQtyEntry(pending, t.fractionKey)
            ? Math.floor(entry.qty) + parseQty(pending).qty : entry.qty;

          return (
            <DosageRowCard
              key={t.key}
              labelTitle={t.title}
              timeRange={t.timeRange}
              icon={t.icon}
              bgClass={t.bgClass}
              borderClass={t.borderClass}
              stripeClass={t.stripeClass}
              cardClass={t.cardClass}
              qtyValue={previewQty}
              isFraction={pending ? true : entry.isFraction}
              fractionPreview={pending}
              isActive={isActive}
              onOpenQtyPad={() => openNumberPad(t.key)}
              onOpenXYPad={() => openNumberPad(t.fractionKey)}
              onDecrement={() => decrementDosage(t.key)}
              onIncrement={() => incrementDosage(t.key)}
            />
          );
        })}
      </fieldset>
    </section>
  );
}
