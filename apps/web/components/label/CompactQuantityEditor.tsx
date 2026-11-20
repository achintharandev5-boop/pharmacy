'use client';

import React, { useState } from 'react';
import { Minus, Plus, ChevronDown, Check, X, type LucideIcon } from 'lucide-react';
import { validateQtyEntry, type ActiveControl } from '../../store/labelStore';
import { MINUS_PRESSED, MINUS_TONE, PLUS_PRESSED, PLUS_TONE, STEP_DISABLED, XY_IDLE, XY_SELECTED } from './buttonVariants';

export const QUICK_FRACTIONS = ['1/4', '1/2', '3/4'] as const;

const CONTROL =
  'rounded-ui-lg flex items-center justify-center transition-all cursor-pointer select-none touch-manipulation active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';
const FRACTION_INPUT =
  'w-full min-w-0 h-11 text-center border border-border-strong rounded-ui-lg font-bold text-base bg-page text-fg placeholder:text-subtle placeholder:font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary-border';

/**
 * Compact quantity entry used by every action that asks for a quantity (STAT, 5H/6H/8H, Daily,
 * Evening, Weekly, ENT custom): a large quantity, X/Y, − and +, then Cancel and Done (Next).
 * Presentational only: the caller owns the value and applies it through the existing store logic.
 */
export function CompactQuantityEditor({
  icon: Icon,
  iconClass,
  iconSvgClass,
  title,
  description,
  quantityLabel,
  display,
  hasQuantity,
  hint,
  error,
  ariaName,
  testId,
  fractionTarget,
  onIncrement,
  onDecrement,
  onFraction,
  onCancel,
  onConfirm,
  confirmLabel = 'Done (Next)',
  disabled = false,
  initialFractionOpen = false,
  onEditValue,
  editValueLabel,
  canDecrease,
  canConfirm,
}: {
  icon: LucideIcon;
  /** Colour classes of the header icon tile, as on the matching grid button. */
  iconClass: string;
  iconSvgClass?: string;
  title: string;
  description?: string;
  quantityLabel: string;
  /** The quantity as staff read it (existing dosage formatting). */
  display: string;
  hasQuantity: boolean;
  /** Shown while there is no quantity yet. */
  hint: string;
  error?: string | null;
  /** Used in button names, e.g. "Increase STAT quantity". */
  ariaName: string;
  testId: string;
  /** The `_fraction` number-pad target whose rule checks a typed X/Y. */
  fractionTarget: ActiveControl;
  onIncrement: () => void;
  onDecrement: () => void;
  /** A fraction such as "1/2" added to the whole number, or 'clear' to remove the fraction. Omit to hide X/Y. */
  onFraction?: (fraction: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  disabled?: boolean;
  /** Open the X/Y choices straight away (the action's own X/Y button was pressed). */
  initialFractionOpen?: boolean;
  /** Makes the large value a button that opens typed entry (e.g. the Days number pad). */
  onEditValue?: () => void;
  editValueLabel?: string;
  /** Override when − is enabled (default: there is a quantity). */
  canDecrease?: boolean;
  /** Override when Done (Next) is enabled (default: there is a quantity). */
  canConfirm?: boolean;
}) {
  const [selectedStep, setSelectedStep] = useState<'plus' | 'minus' | null>(null);
  const [fractionOpen, setFractionOpen] = useState(initialFractionOpen);
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [fractionError, setFractionError] = useState<string | null>(null);
  const hintId = `${testId}-hint`;

  const chooseFraction = (fraction: string) => {
    onFraction?.(fraction);
    setFractionOpen(false);
    setFractionError(null);
    setX(''); setY('');
  };
  const applyTyped = () => {
    const text = `${x.trim()}/${y.trim()}`;
    // Same rule as the number pad's X/Y entry (a fraction smaller than 1, never divided by 0).
    const problem = !x.trim() || !y.trim() ? 'Enter both X and Y.' : validateQtyEntry(text, fractionTarget);
    if (problem) { setFractionError(problem); return; }
    chooseFraction(text);
  };

  // One message slot beside the value: a typed X/Y problem, the store's validation error, the
  // hint while there is no quantity, or the short description. A message never adds a row.
  const message = fractionError ?? error;

  // Normal document flow, top to bottom: (1) title + quantity label, (2) value + message,
  // (3) X/Y, −, +, (4) fraction presets and (5) typed X/Y while X/Y is open, (6) Cancel + Done.
  // The surrounding panel keeps its size; opening X/Y only uses the free space above the footer.
  return (
    <div data-testid={`${testId}-editor`} className="w-full flex-1 min-h-0 flex flex-col gap-2 select-none">
      {/* 1. Title and quantity label */}
      <div className="shrink-0 flex items-center gap-2.5 min-w-0">
        <div className={`w-9 h-9 shrink-0 rounded-ui-lg border flex items-center justify-center ${iconClass}`}>
          <Icon size={18} className={iconSvgClass} aria-hidden="true" />
        </div>
        <h3 className="min-w-0 text-base xl:text-lg font-bold text-fg leading-tight">{title}</h3>
        {description && <p className="sr-only">{description}</p>}
        <span className="ml-auto shrink-0 text-xs font-bold text-subtle uppercase tracking-wider">{quantityLabel}</span>
      </div>

      {/* 2. Quantity and its supporting text */}
      <div className="shrink-0 flex items-center gap-3 rounded-ui-lg bg-surface border border-border px-3 py-1.5 min-h-(--ws-ctl)">
        {onEditValue ? (
          <button type="button" onClick={onEditValue} aria-label={editValueLabel} data-testid={testId}
            className="shrink-0 min-w-16 text-4xl xl:text-5xl leading-none font-black text-fg tabular px-2 py-1 rounded-ui-lg border-2 border-dashed border-transparent hover:border-primary-border hover:text-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            {display || '0'}
          </button>
        ) : (
          <span data-testid={testId} className="shrink-0 min-w-12 text-4xl xl:text-5xl leading-none font-black text-fg tabular">
            {display || '0'}
          </span>
        )}
        {message ? (
          <span role="alert" className="flex-1 min-w-0 text-sm font-bold text-danger leading-snug">{message}</span>
        ) : !hasQuantity ? (
          <span id={hintId} className="flex-1 min-w-0 text-sm font-semibold text-muted leading-snug">{hint}</span>
        ) : (
          <span aria-hidden="true" className="flex-1 min-w-0 text-sm font-medium text-muted leading-snug">{description}</span>
        )}
      </div>

      {/* 3. X/Y, minus, plus */}
      <div className={`shrink-0 grid gap-2 ${onFraction ? 'grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]' : 'grid-cols-2'}`}>
        {onFraction && (
          <button
            type="button"
            onClick={() => { setFractionOpen((open) => !open); setFractionError(null); }}
            aria-expanded={fractionOpen}
            aria-label={`Enter ${ariaName} fraction`}
            disabled={disabled}
            className={`${CONTROL} h-(--ws-ctl) gap-1.5 border-2 font-black text-lg disabled:opacity-40 disabled:cursor-not-allowed ${
              fractionOpen ? XY_SELECTED : XY_IDLE
            }`}
          >
            <span>X / Y</span>
            <ChevronDown size={20} strokeWidth={2.75} aria-hidden="true" className={`transition-transform ${fractionOpen ? 'rotate-180' : ''}`} />
          </button>
        )}
        <button
          type="button"
          onClick={() => { setSelectedStep('minus'); onDecrement(); }}
          aria-pressed={selectedStep === 'minus'}
          disabled={disabled || !(canDecrease ?? hasQuantity)}
          aria-label={`Decrease ${ariaName} quantity`}
          className={`${CONTROL} h-(--ws-ctl) border-2 ${MINUS_TONE} ${STEP_DISABLED} ${selectedStep === 'minus' ? MINUS_PRESSED : ''}`}
        >
          <Minus className="w-7 h-7" strokeWidth={3} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => { setSelectedStep('plus'); onIncrement(); }}
          aria-pressed={selectedStep === 'plus'}
          disabled={disabled}
          aria-label={`Increase ${ariaName} quantity`}
          className={`${CONTROL} h-(--ws-ctl) ${PLUS_TONE} shadow-sm ${STEP_DISABLED} ${selectedStep === 'plus' ? PLUS_PRESSED : ''}`}
        >
          <Plus className="w-7 h-7" strokeWidth={3} aria-hidden="true" />
        </button>
      </div>

      {/* 4 + 5. X/Y choices: the pad's ¼ ½ ¾ shortcuts, no fraction, or any X/Y smaller than 1 */}
      {onFraction && fractionOpen && (
        <div role="group" aria-label={`${ariaName} fraction`} className="shrink-0 flex flex-col gap-2">
          <div className="grid grid-cols-4 gap-2">
            {QUICK_FRACTIONS.map((fraction) => (
              <button key={fraction} type="button" onClick={() => chooseFraction(fraction)}
                className={`${CONTROL} h-11 bg-page border border-purple-border text-purple-strong font-bold text-base hover:bg-purple-soft`}>
                {fraction}
              </button>
            ))}
            <button type="button" onClick={() => chooseFraction('clear')}
              className={`${CONTROL} h-11 bg-page border border-border-strong text-fg font-bold text-sm hover:bg-surface-2`}>
              None
            </button>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_minmax(0,1.6fr)] items-center gap-2">
            <input aria-label="X" inputMode="numeric" placeholder="X" value={x}
              onChange={(e) => { setX(e.target.value.replace(/\D/g, '')); setFractionError(null); }}
              className={FRACTION_INPUT} />
            <span className="font-bold text-muted" aria-hidden="true">/</span>
            <input aria-label="Y" inputMode="numeric" placeholder="Y" value={y}
              onChange={(e) => { setY(e.target.value.replace(/\D/g, '')); setFractionError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') applyTyped(); }}
              className={FRACTION_INPUT} />
            <button type="button" onClick={applyTyped}
              className={`${CONTROL} h-11 px-3 bg-page border-2 border-purple text-purple-strong font-bold text-sm whitespace-nowrap hover:bg-purple-soft`}>
              Apply X/Y
            </button>
          </div>
        </div>
      )}

      {/* 6. Cancel and Done (Next), always at the bottom of the panel */}
      <div className="mt-auto shrink-0 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className={`${CONTROL} h-(--ws-ctl) gap-1.5 bg-page border border-border-strong hover:bg-surface text-fg font-bold text-base`}
        >
          <X size={18} aria-hidden="true" />
          <span>Cancel</span>
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={disabled || !(canConfirm ?? hasQuantity)}
          aria-describedby={hasQuantity ? undefined : hintId}
          className={`${CONTROL} h-(--ws-ctl) gap-1.5 bg-primary-solid hover:bg-primary-solid-hover text-on-primary-solid font-bold text-base shadow-sm disabled:bg-surface-2 disabled:text-disabled disabled:shadow-none disabled:cursor-not-allowed disabled:active:scale-100`}
        >
          <Check size={18} strokeWidth={2.5} aria-hidden="true" />
          <span>{confirmLabel}</span>
        </button>
      </div>
    </div>
  );
}
