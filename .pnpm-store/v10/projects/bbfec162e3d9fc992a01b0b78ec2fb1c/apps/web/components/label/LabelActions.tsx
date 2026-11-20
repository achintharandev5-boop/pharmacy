'use client';

import React from 'react';
import { reasonSelectionRefusal } from '../../lib/reasons';
import { dosageText } from '../../lib/dosageQuantity';
import { useLabelStore, isStatStep } from '../../store/labelStore';
import { analyseAdministration, timingLockingInstructions } from '../../lib/instructionEngine';
import { ControlHints, LockNoticeLine, useLockNotice, hintId, STAT_LOCK_HINT } from './InstructionTile';
import { MINUS_TONE, PLUS_TONE } from './buttonVariants';
import { Hand, User, Clock, Check, type LucideIcon } from 'lucide-react';

const ADMIN_BUTTON_CLASS =
  'relative h-(--ws-ctl) min-w-0 rounded-ui-lg border flex items-center justify-center gap-1.5 xl:gap-2 font-black text-base xl:text-lg tracking-wide transition-colors select-none touch-manipulation cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 aria-disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:active:scale-100';
// Same selected treatment as the action tiles: tint, 2 px border and a check badge.
const ADMIN_SELECTED_CLASS = 'bg-primary-soft border-2 border-primary text-primary-hover shadow-sm';
// Idle buttons are neutral surfaces; only the icon carries a subtle accent (no coloured fills, so
// AFTER never reads as success).
const ADMIN_IDLE_CLASS = 'bg-page border-border-strong text-fg hover:bg-surface hover:border-primary-border active:bg-primary-soft';
// Inline quantity confirmation (Weekly / Daily / Evening): the recovery path after the panel's Cancel.
const INLINE_BASE = 'h-11 px-3 rounded-ui-lg font-bold text-sm cursor-pointer select-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed';
const INLINE_PRIMARY = `${INLINE_BASE} bg-primary-solid text-on-primary-solid hover:bg-primary-solid-hover`;
const INLINE_SECONDARY = `${INLINE_BASE} bg-page border border-border-strong text-fg hover:bg-surface`;
const INLINE_MINUS = `${INLINE_BASE} border ${MINUS_TONE}`;
const INLINE_PLUS = `${INLINE_BASE} ${PLUS_TONE}`;
const ADMIN_DISABLED_CLASS = 'bg-surface border-border text-subtle';
// Four buttons share the row: icons are dropped on narrow cards so labels never overlap.
const ADMIN_ICON_CLASS = 'hidden @min-[460px]:block shrink-0';

type AdminButton = {
  key: 'GIVE' | 'TAKE' | 'BEFORE' | 'AFTER';
  label: string;
  ariaLabel: string;
  icon: LucideIcon;
  /** Icon accent (idle and selected); the button surface itself stays neutral. */
  accent: string;
};

// GIVE/TAKE replace each other, as do BEFORE/AFTER (store: toggleAdditionalInstruction).
// One of each pair can be combined: e.g. TAKE + AFTER.
const BUTTONS: AdminButton[] = [
  {
    key: 'GIVE',
    label: 'GIVE',
    ariaLabel: 'Give medication',
    icon: Hand,
    accent: 'text-teal',
  },
  {
    key: 'TAKE',
    label: 'TAKE',
    ariaLabel: 'Take medication',
    icon: User,
    accent: 'text-primary',
  },
  {
    key: 'BEFORE',
    label: 'BEFORE',
    ariaLabel: 'Before meals',
    icon: Clock,
    accent: 'text-amber',
  },
  {
    key: 'AFTER',
    label: 'AFTER',
    ariaLabel: 'After meals',
    icon: Clock,
    accent: 'text-purple',
  },
];

const WORKFLOW_NAMES: Record<string, string> = {
  NAB: 'Normal',
  CHEWABLE: 'Chewable',
  'KEEP IN MOUTH': 'Keep in Mouth',
  'DISSOLVE AND DRINK': 'Dissolve and Drink',
  'EMPTY STOMACH': 'Empty Stomach',
  'WITH FOOD': 'With Food',
  'EMPTY STOMACH + KEEP IN MOUTH': 'Empty Stomach + Keep in Mouth',
  'WITH FOOD + CHEWABLE': 'With Food + Chewable',
  'EMPTY STOMACH + CHEWABLE': 'Empty Stomach + Chewable',
  'WITH FOOD + DISSOLVE AND DRINK': 'With Food + Dissolve and Drink',
  'EMPTY STOMACH + DISSOLVE AND DRINK': 'Empty Stomach + Dissolve and Drink',
};

export function LabelActions() {
  const activeLabel = useLabelStore(state => state.labels[state.activeLabelIndex]);
  const additionalInstructions = useLabelStore((state) => state.additionalInstructions);
  const dosage = useLabelStore((state) => state.dosage);
  const frequencyDosage = useLabelStore((state) => state.frequencyDosage);
  const weeklyDosage = useLabelStore(state => state.weeklyDosage);
  const confirmWeekly = useLabelStore(state => state.confirmWeekly);
  const incrementWeeklyDosage = useLabelStore(state => state.incrementWeeklyDosage);
  const decrementWeeklyDosage = useLabelStore(state => state.decrementWeeklyDosage);
  const confirmDaily = useLabelStore(state => state.confirmDaily);
  const confirmEvening = useLabelStore(state => state.confirmEvening);
  const cancelNumberPad = useLabelStore(state => state.cancelNumberPad);
  const numberPadVisible = useLabelStore(state => state.numberPad.visible);
  const activeControl = useLabelStore((state) => state.activeControl);
  const toggleAdditionalInstruction = useLabelStore((state) => state.toggleAdditionalInstruction);
  const openNumberPad = useLabelStore((state) => state.openNumberPad);

  // The label's own administration is not editable while the STAT dose's is being chosen.
  const isStatActive = isStatStep(activeControl);
  const locking = timingLockingInstructions();
  const lockingInstruction = additionalInstructions.find((i) => locking.includes(i));
  // Same analysis DONE uses, so the guidance here and the check at DONE always agree.
  const analysis = analyseAdministration(additionalInstructions, dosage, undefined, frequencyDosage.qty);
  const needs = (key: AdminButton['key']) =>
    key === 'TAKE' || key === 'GIVE'
      ? analysis.missing.includes('TAKE_OR_GIVE')
      : analysis.missing.includes('BEFORE_OR_AFTER');
  // Why a button is locked: the same conditions that disabled it before, now also explained.
  // A locked timing that is still selected can be removed, never added.
  const timingLocked = (key: string) => (key === 'BEFORE' || key === 'AFTER') && Boolean(lockingInstruction) && !additionalInstructions.includes(key);
  // The ENT button was removed from the workstation; ENT data already on a label is kept, shown in
  // Selected Instructions (removable there) and still saved and printed.
  const lockHint = (key: string): string | null => isStatActive
    ? STAT_LOCK_HINT
    : timingLocked(key)
      ? `Before/After not used with ${lockingInstruction?.toLowerCase()}`
      : reasonSelectionRefusal(activeLabel, key);
  const controls = BUTTONS;
  const [lockNotice, setLockNotice] = useLockNotice();

  return (
    <div className="@container w-full bg-page border border-border rounded-ui-lg p-2 shadow-card shrink-0">
      {/* The section shows only GIVE, TAKE, BEFORE and AFTER. The workflow name and its next step
          are not drawn, but stay available to screen readers (and the buttons' descriptions). */}
      <div className="sr-only">
        <h2>Administration</h2>
        {analysis.workflow !== 'NONE' && (
          <span data-testid="admin-workflow">{WORKFLOW_NAMES[analysis.workflow]}</span>
        )}
        <span id="admin-status" data-testid="admin-status" data-status={analysis.status} role="status">
          {analysis.status === 'complete'
            ? 'Complete'
            : analysis.nextStep
              ? `Next: ${analysis.nextStep}`
              : lockingInstruction
                ? `Before/After not used with ${lockingInstruction.toLowerCase()}`
                : ''}
        </span>
      </div>

      {additionalInstructions.includes('WEEKLY') && !additionalInstructions.some(code => code.startsWith('ENT:v1:')) && (
        <div role="group" aria-label="Weekly quantity" className="flex flex-wrap items-center gap-2 mb-2">
          <button type="button" aria-label="Weekly quantity value" onClick={() => openNumberPad('weekly')} disabled={isStatActive} className={`${INLINE_SECONDARY} text-sm`}>Weekly: {dosageText(weeklyDosage.qty, weeklyDosage.isFraction)}</button>
          <button type="button" aria-label="Decrease Weekly quantity" onClick={decrementWeeklyDosage} disabled={isStatActive || weeklyDosage.qty <= 0} className={`${INLINE_MINUS} w-11 px-0 text-lg`}>-</button>
          <button type="button" aria-label="Increase Weekly quantity" onClick={incrementWeeklyDosage} disabled={isStatActive} className={`${INLINE_PLUS} w-11 px-0 text-lg`}>+</button>
          <button type="button" onClick={() => openNumberPad('weekly_fraction')} disabled={isStatActive} className={`${INLINE_SECONDARY} text-sm`}>Weekly X/Y</button>
          <button type="button" onClick={confirmWeekly} aria-pressed={weeklyDosage.confirmed === true} disabled={isStatActive || numberPadVisible || !Number.isFinite(weeklyDosage.qty) || weeklyDosage.qty <= 0} className={INLINE_PRIMARY}>Done - Weekly</button>
          <button type="button" onClick={cancelNumberPad} disabled={isStatActive} className={INLINE_SECONDARY}>Back from Weekly</button>
        </div>
      )}
      {additionalInstructions.includes('DAILY') && !additionalInstructions.some(code => code.startsWith('ENT:v1:')) && (
        <div role="group" aria-label="Daily quantity" className="flex flex-wrap items-center gap-2 mb-2">
          <button type="button" onClick={confirmDaily} disabled={isStatActive || numberPadVisible || !Number.isFinite(frequencyDosage.qty) || frequencyDosage.qty <= 0}
            className={INLINE_PRIMARY}>Done - Daily</button>
          <button type="button" onClick={cancelNumberPad} disabled={isStatActive} className={INLINE_SECONDARY}>Back from Daily</button>
        </div>
      )}
      {additionalInstructions.includes('EVENING') && !additionalInstructions.some(code => code.startsWith('ENT:v1:')) && (
        <div role="group" aria-label="Evening quantity" className="flex flex-wrap items-center gap-2 mb-2">
          <button type="button" onClick={confirmEvening} aria-pressed={frequencyDosage.confirmed === true} disabled={isStatActive || numberPadVisible || !Number.isFinite(frequencyDosage.qty) || frequencyDosage.qty <= 0}
            className={INLINE_PRIMARY}>
            {frequencyDosage.confirmed ? 'Evening confirmed' : 'Done — enable Digital Label'}
          </button>
          <button type="button" onClick={cancelNumberPad} disabled={isStatActive} className={INLINE_SECONDARY}>Back from Evening</button>
        </div>
      )}
      {/* A tap on a locked button is announced (not drawn); the button's tooltip also gives the reason. */}
      <div className="sr-only">
        <LockNoticeLine notice={lockNotice} onDismiss={() => setLockNotice(null)} />
      </div>
      {/* Give, Take, Before, After: one row of four equal buttons; 2 + 2 on a narrow (phone) card. */}
      <div className="grid grid-cols-2 @min-[360px]:grid-cols-4 gap-2">
        {controls.map((b) => {
          const selected = additionalInstructions.includes(b.key);
          const locked = timingLocked(b.key);
          const hint = lockHint(b.key);
          const disabled = Boolean(hint);
          const required = !disabled && needs(b.key);
          const Icon = b.icon;
          const describedBy = [disabled ? hintId('admin', b.key) : null, required || locked ? 'admin-status' : null].filter(Boolean).join(' ');
          return (
            <button
              key={b.key}
              type="button"
              aria-disabled={disabled || undefined}
              onClick={() => {
                if (disabled) setLockNotice({ label: b.label, hint: hint! });
                else toggleAdditionalInstruction(b.key);
              }}
              aria-pressed={selected}
              aria-label={b.ariaLabel}
              aria-describedby={describedBy || undefined}
              data-required={required || undefined}
              data-selected={selected || undefined}
              title={disabled ? hint! : undefined}
              className={`${ADMIN_BUTTON_CLASS} ${
                selected ? ADMIN_SELECTED_CLASS : ADMIN_IDLE_CLASS
              } ${disabled ? ADMIN_DISABLED_CLASS : ''}`}
            >
              {selected && (
                <span aria-hidden="true" data-testid="selected-badge" className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary-solid text-on-primary-solid flex items-center justify-center">
                  <Check size={13} strokeWidth={3.5} />
                </span>
              )}
              <Icon size={22} aria-hidden="true" className={`${disabled ? 'text-subtle' : b.accent} ${ADMIN_ICON_CLASS}`} />
              <span>{b.label}</span>
            </button>
          );
        })}
      </div>
      <ControlHints hints={controls.map((b) => ({ id: hintId('admin', b.key), text: lockHint(b.key) }))} />
    </div>
  );
}
