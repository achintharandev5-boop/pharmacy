'use client';

import React, { useEffect, useRef } from 'react';
import { useLabelStore, isStatStep } from '../../store/labelStore';
import { EXPIRY_CODE } from '../../lib/batchExpiry';
import { STAT_LOCK_HINT } from './InstructionTile';
import { useActiveWorkspace } from './ActionWorkspace';
import { Calendar, Check, ChevronLeft, ChevronRight } from 'lucide-react';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

interface BottomActionBarProps {
  onDone: () => void;
}

export function BottomActionBar({ onDone }: BottomActionBarProps) {
  const activeControl = useLabelStore((state) => state.activeControl);
  const isStatActive = isStatStep(activeControl);
  // Leaving a label mid-STAT would abandon the entry, so label navigation waits for it.
  const isStatFlow = isStatStep(activeControl);

  const selectLabel = useLabelStore((state) => state.selectLabel);
  const openExpDateModal = useLabelStore((state) => state.openExpDateModal);

  const activeLabelIndex = useLabelStore((state) => state.activeLabelIndex);
  const totalLabels = useLabelStore((state) => state.labels.length);
  const expiryDate = useLabelStore((state) => state.expiryDate);
  const expirySelected = useLabelStore((state) => state.additionalInstructions.includes(EXPIRY_CODE));
  const expiryIsTestValue = useLabelStore((state) => state.expiryBatch?.source === 'ui-test');
  const toggleAdditionalInstruction = useLabelStore((state) => state.toggleAdditionalInstruction);
  const expDateModalVisible = useLabelStore((state) => state.expDateModalVisible);

  // When the batch dialog it opened closes (choice, Close or Escape), focus returns to the chooser.
  const batchButton = useRef<HTMLButtonElement>(null);
  const batchDialogOpener = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (expDateModalVisible || !batchDialogOpener.current) return;
    const opener = batchDialogOpener.current;
    batchDialogOpener.current = null;
    if (opener.isConnected) opener.focus();
  }, [expDateModalVisible]);

  const handleExpDateClick = () => {
    if (isStatFlow) return;
    // Same control as the Add Expiry Date tile: retrieves the GRN batch expiry, or removes it.
    toggleAdditionalInstruction(EXPIRY_CODE);
  };

  const isPrevDisabled = isStatFlow || activeLabelIndex <= 0;
  const isNextDisabled = isStatFlow || activeLabelIndex >= totalLabels - 1;

  // Keyboard shortcuts: Ctrl+Enter = DONE, Page Up / Page Down = previous / next label. They do the
  // same as the buttons and are ignored while an action panel is open (finish or cancel it first),
  // during STAT, and (labels only) while typing in a field.
  const workspace = useActiveWorkspace();
  const shortcutsBlocked = Boolean(workspace) || isStatActive;
  useEffect(() => {
    if (shortcutsBlocked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.repeat) return;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onDone();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.shiftKey || (e.key !== 'PageUp' && e.key !== 'PageDown')) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'PageUp' && !isPrevDisabled) { e.preventDefault(); selectLabel(activeLabelIndex - 1); }
      if (e.key === 'PageDown' && !isNextDisabled) { e.preventDefault(); selectLabel(activeLabelIndex + 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcutsBlocked, onDone, isPrevDisabled, isNextDisabled, activeLabelIndex, selectLabel]);

  return (
    // Desktop: one compact 64 px row. Below 1024 px the page scrolls, so the bar sticks to the bottom and
    // DONE is always reachable; on phones DONE takes its own full-width row.
    <footer className="w-full shrink-0 select-none sticky bottom-0 z-20 bg-[var(--color-canvas)] py-2 lg:static lg:py-0 lg:h-16">
      <div className="w-full h-full grid items-stretch gap-2 grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] sm:grid-cols-[minmax(0,2.5fr)_minmax(0,2.2fr)_minmax(0,2.7fr)] [&>*]:h-14 sm:[&>*]:h-16 lg:[&>*]:h-full">
        {/* Expiry: two sibling buttons (toggle the GRN expiry; choose its batch). */}
        <div className="h-full">
          <div className="w-full h-full bg-page border border-border rounded-ui-lg pl-1.5 pr-2 flex items-center justify-between gap-2 shadow-card hover:border-primary-border transition-colors">
            <button
              type="button"
              aria-disabled={isStatFlow || undefined}
              aria-describedby={isStatFlow ? 'bottom-stat-lock' : undefined}
              aria-pressed={expirySelected}
              aria-label={expiryDate ? `Expiry date ${expiryDate} will be printed. Remove expiry date` : 'Expiry date not added. Add expiry date from the GRN batch'}
              onClick={handleExpDateClick}
              className={`flex-1 min-w-0 h-full flex items-center gap-2 xl:gap-3 px-1.5 xl:px-2.5 rounded-ui-lg text-left cursor-pointer select-none aria-disabled:cursor-not-allowed ${FOCUS_RING} ${
                isStatActive ? 'opacity-40' : ''
              }`}
            >
              <span
                className={`shrink-0 hidden sm:flex w-10 h-10 rounded-ui-lg border items-center justify-center ${
                  expiryDate ? 'bg-success-soft border-success-border text-success' : 'bg-amber-soft border-amber-border text-amber-strong'
                }`}
                aria-hidden="true"
              >
                <Calendar size={22} />
              </span>
              <span className="min-w-0 text-sm xl:text-base leading-tight break-words">
                <span className="font-semibold text-subtle">Expiry: </span>
                {expiryDate
                  ? <span className="font-black text-fg tabular">{`${expiryDate}${expiryIsTestValue ? ' (test)' : ''}`}</span>
                  : <span className="font-bold text-muted">{expirySelected ? 'Not retrieved' : 'Not added'}</span>}
              </span>
            </button>

            <button
              ref={batchButton}
              type="button"
              onClick={() => {
                if (isStatFlow) return;
                batchDialogOpener.current = batchButton.current;
                openExpDateModal();
              }}
              className={`w-11 h-11 rounded-ui-lg bg-primary-soft border border-primary-border hover:bg-primary-border text-primary flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 aria-disabled:opacity-40 aria-disabled:cursor-not-allowed ${FOCUS_RING}`}
              title="Choose the batch"
              aria-label="Choose the batch for the expiry date"
              aria-disabled={isStatFlow || undefined}
              aria-describedby={isStatFlow ? 'bottom-stat-lock' : undefined}
            >
              <Calendar size={22} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Label navigation */}
        <div className="h-full">
          <div className="w-full h-full bg-page border border-border rounded-ui-lg px-1.5 sm:px-2 lg:px-4 flex items-center justify-between gap-1 shadow-card">
            <button
              type="button"
              disabled={isPrevDisabled}
              onClick={() => selectLabel(activeLabelIndex - 1)}
              aria-label="Previous label"
              aria-keyshortcuts="PageUp"
              title="Previous label (Page Up)"
              aria-describedby={isStatFlow ? 'bottom-stat-lock' : undefined}
              className={`w-12 h-12 shrink-0 rounded-ui-lg bg-primary-soft border border-primary-border hover:bg-primary-border active:scale-95 text-primary flex items-center justify-center font-bold transition-all cursor-pointer ${FOCUS_RING} ${
                isPrevDisabled ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              <ChevronLeft size={28} strokeWidth={2.5} aria-hidden="true" />
            </button>

            <span aria-live="polite" className="font-black text-sm sm:text-lg text-primary select-none text-center whitespace-nowrap tabular">
              Label {activeLabelIndex + 1} / {totalLabels}
            </span>

            <button
              type="button"
              disabled={isNextDisabled}
              onClick={() => selectLabel(activeLabelIndex + 1)}
              aria-label="Next label"
              aria-keyshortcuts="PageDown"
              title="Next label (Page Down)"
              aria-describedby={isStatFlow ? 'bottom-stat-lock' : undefined}
              className={`w-12 h-12 shrink-0 rounded-ui-lg bg-primary-soft border border-primary-border hover:bg-primary-border active:scale-95 text-primary flex items-center justify-center font-bold transition-all cursor-pointer ${FOCUS_RING} ${
                isNextDisabled ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              <ChevronRight size={28} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* DONE */}
        <div className="col-span-2 sm:col-span-1">
          <button
            type="button"
            onClick={() => { if (!isStatActive) onDone(); }}
            aria-disabled={isStatActive || undefined}
            aria-describedby={isStatActive ? 'bottom-stat-lock' : undefined}
            title={isStatActive ? STAT_LOCK_HINT : 'Review and print (Ctrl+Enter)'}
            aria-label="Done — review and print labels"
            aria-keyshortcuts="Control+Enter"
            className={`group w-full h-full bg-primary-solid text-on-primary-solid rounded-ui-lg px-4 sm:px-6 flex items-center justify-between gap-3 shadow-card transition-all select-none touch-manipulation cursor-pointer active:scale-[0.99] ${FOCUS_RING} ${
              isStatActive ? 'opacity-40 cursor-not-allowed shadow-none active:scale-100' : 'hover:bg-primary-solid-hover active:bg-primary-solid-active'
            }`}
          >
            <span aria-hidden="true" className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-page/20 ring-1 ring-[var(--color-on-primary-solid)]/30 flex items-center justify-center shrink-0">
              <Check size={26} strokeWidth={3} className="text-on-primary-solid" />
            </span>

            <span aria-hidden="true" className="flex flex-col items-center leading-none">
              <span className="font-black text-2xl sm:text-3xl xl:text-4xl tracking-wider text-on-primary-solid">DONE</span>
              <span className="mt-1 text-[11px] sm:text-xs font-semibold tracking-wide text-on-primary-solid/90">
                Review &amp; Print Labels
              </span>
            </span>

            {/* Right: Chevron */}
            <ChevronRight size={30} strokeWidth={2.5} className="text-on-primary-solid shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <span id="bottom-stat-lock" className="sr-only">{STAT_LOCK_HINT}</span>
    </footer>
  );
}
