'use client';

import React from 'react';
import { useLabelStore } from '../store/labelStore';
import { QUANTITY_CODES } from '../lib/instructionEngine';
import { Delete, Check, Hash } from 'lucide-react';

/** What the pad is filling in, in the words staff use. */
const TARGET_LABELS: Record<string, string> = {
  weekly: 'WEEKLY QTY',
  weekly_fraction: 'WEEKLY FRACTION (X/Y)',
  morning: 'MORNING QTY',
  lunch: 'LUNCH QTY',
  night: 'NIGHT QTY',
  morning_fraction: 'MORNING FRACTION (X/Y)',
  lunch_fraction: 'LUNCH FRACTION (X/Y)',
  night_fraction: 'NIGHT FRACTION (X/Y)',
  stat: 'STAT QTY',
  stat_fraction: 'STAT FRACTION (X/Y)',
  days: 'DAYS',
  product_quantity: 'PRODUCT QTY',
  frequency_fraction: 'FREQUENCY FRACTION (X/Y)',
};

export function NumberPad() {
  const {
    numberPad,
    appendDigit,
    backspace,
    clearNumberPadBuffer,
    confirmNumberPad,
    cancelNumberPad,
    setQuickFraction,
    additionalInstructions,
  } = useLabelStore();

  const handleDigit = (digit: string) => {
    appendDigit(digit);
  };

  const handleFraction = () => {
    if (!numberPad.buffer.includes('/')) {
      appendDigit('/');
    }
  };

  const isFractionTarget = numberPad.targetControl?.endsWith('_fraction');

  const frequencyCode = additionalInstructions.find((i) => QUANTITY_CODES.includes(i));
  const activeControlLabel = !numberPad.targetControl
    ? 'INPUT'
    : numberPad.targetControl === 'frequency' && frequencyCode
      ? `${frequencyCode} — QTY PER DOSE`
      : (TARGET_LABELS[numberPad.targetControl] ?? numberPad.targetControl.replace(/_/g, ' ').toUpperCase());

  return (
    <div className="flex flex-col h-full select-none touch-manipulation overflow-hidden p-1">
      {/* Target Control Header Indicator */}
      <div className="flex items-center justify-between mb-2.5 bg-primary-soft border border-primary-border px-4 py-2.5 rounded-ui-lg shadow-sm shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-ui-lg bg-primary text-[var(--color-on-solid)] flex items-center justify-center shadow-sm shrink-0">
            <Hash size={18} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-[10px] font-bold text-subtle uppercase tracking-wider leading-none">
              Entering
            </span>
            <span className="text-sm font-black text-primary tracking-wide leading-tight mt-0.5">
              {activeControlLabel}
            </span>
          </div>
        </div>

        {/* Value Display Box */}
        <div className="bg-page border border-border px-4 py-1 rounded-ui-lg shadow-sm min-w-[85px] text-right">
          <span className="text-2xl font-black text-fg leading-tight">
            {numberPad.buffer || '0'}
          </span>
        </div>
      </div>

      {numberPad.error && (
        <div role="alert" className="mb-2.5 shrink-0 bg-danger-soft border border-danger-border text-danger text-sm font-bold rounded-ui-lg px-3 py-2">
          {numberPad.error}
        </div>
      )}

      {/* QUICK FRACTIONS PANEL IF FRACTION TARGET */}
      {isFractionTarget && (
        <div className="mb-2.5 grid grid-cols-4 gap-2.5 shrink-0">
          {['1/4', '1/2', '3/4'].map((frac) => (
            <button
              key={frac}
              type="button"
              onClick={() => { clearNumberPadBuffer(); appendDigit(frac); }}
              aria-pressed={numberPad.buffer === frac}
              className={`h-14 border rounded-ui-lg font-black text-base shadow-sm transition-all select-none touch-manipulation cursor-pointer flex items-center justify-center ${numberPad.buffer === frac ? 'bg-primary border-primary text-[var(--color-on-solid)]' : 'bg-page border-border text-primary hover:bg-primary-soft'}`}
            >
              {frac}
            </button>
          ))}
          {/* Clear fraction — resets the fractional part back to a whole number */}
          <button
            type="button"
            onClick={() => setQuickFraction('clear')}
            aria-label="Clear fraction"
            className="h-14 bg-danger-soft border border-danger-border text-danger hover:bg-danger-soft active:scale-95 font-black text-sm rounded-ui-lg shadow-sm transition-all select-none touch-manipulation cursor-pointer flex items-center justify-center"
          >
            CLR
          </button>
        </div>
      )}

      {/* 4x4 Keypad Grid */}
      <div className="flex-1 grid grid-cols-4 grid-rows-4 gap-2.5 min-h-0">
        <NumBtn onClick={() => handleDigit('7')}>7</NumBtn>
        <NumBtn onClick={() => handleDigit('8')}>8</NumBtn>
        <NumBtn onClick={() => handleDigit('9')}>9</NumBtn>
        <ActionBtn onClick={clearNumberPadBuffer} color="red" label="Clear entry">AC</ActionBtn>

        <NumBtn onClick={() => handleDigit('4')}>4</NumBtn>
        <NumBtn onClick={() => handleDigit('5')}>5</NumBtn>
        <NumBtn onClick={() => handleDigit('6')}>6</NumBtn>
        <ActionBtn onClick={backspace} color="gray" label="Backspace">
          <Delete size={24} aria-hidden="true" />
        </ActionBtn>

        <NumBtn onClick={() => handleDigit('1')}>1</NumBtn>
        <NumBtn onClick={() => handleDigit('2')}>2</NumBtn>
        <NumBtn onClick={() => handleDigit('3')}>3</NumBtn>
        <ActionBtn onClick={cancelNumberPad} color="gray">BACK</ActionBtn>

        <NumBtn onClick={() => handleDigit('0')}>0</NumBtn>
        <NumBtn onClick={handleFraction}>/</NumBtn>

        {/* ENTER (Spans 2 columns) */}
        <button
          type="button"
          onClick={confirmNumberPad}
          className="col-span-2 bg-success hover:bg-success active:scale-[0.99] text-[var(--color-on-solid)] font-black text-xl lg:text-2xl rounded-ui-lg shadow-md transition-all select-none touch-manipulation cursor-pointer flex items-center justify-center gap-2"
          data-testid="numpad-enter"
        >
          <Check size={24} strokeWidth={3} />
          <span>ENTER</span>
        </button>
      </div>
    </div>
  );
}

function NumBtn({ children, onClick }: { children: React.ReactNode, onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-page border border-border text-fg font-black text-2xl lg:text-3xl rounded-ui-lg hover:bg-surface hover:border-primary-border active:scale-95 transition-all flex items-center justify-center select-none touch-manipulation shadow-card cursor-pointer"
    >
      {children}
    </button>
  );
}

function ActionBtn({
  children,
  onClick,
  color,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  color: 'red' | 'gray';
  /** Accessible name for icon-only keys. */
  label?: string;
}) {
  const colorClass = color === 'red'
    ? 'bg-danger-soft border border-danger-border text-danger hover:bg-danger-soft'
    : 'bg-surface-2 border border-border text-muted hover:bg-border';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`font-black text-base lg:text-lg rounded-ui-lg transition-all flex items-center justify-center select-none touch-manipulation active:scale-95 shadow-sm cursor-pointer ${colorClass}`}
    >
      {children}
    </button>
  );
}
