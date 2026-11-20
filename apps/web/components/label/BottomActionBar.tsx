'use client';

import React, { useEffect, useRef } from 'react';
import { useLabelStore, isStatStep } from '../../store/labelStore';
import { EXPIRY_CODE } from '../../lib/batchExpiry';
import { STAT_LOCK_HINT } from './InstructionTile';
import { useActiveWorkspace } from './ActionWorkspace';
import { CalendarCheck, CalendarPlus, CalendarX2, Check, ChevronLeft, ChevronRight, Layers } from 'lucide-react';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

const NAV_BUTTON = `w-11 h-11 shrink-0 rounded-full border flex items-center justify-center transition-all ${FOCUS_RING}`;
const NAV_BUTTON_ON = 'bg-primary-soft border-primary-border text-primary hover:bg-primary-border active:scale-95 cursor-pointer';
const NAV_BUTTON_OFF = 'bg-transparent border-transparent text-disabled pointer-events-none';

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
          <div className={`w-full h-full bg-page border rounded-ui-lg pl-1.5 pr-2 flex items-center justify-between gap-2 shadow-card transition-colors ${
            expiryDate ? 'border-success-border' : expirySelected ? 'border-warning-border' : 'border-border hover:border-primary-border'
          }`}>
            <button
              type="button"
              aria-disabled={isStatFlow || undefined}
              aria-describedby={isStatFlow ? 'bottom-stat-lock' : undefined}
              aria-pressed={expirySelected}
              aria-label={expiryDate ? `Expiry date ${expiryDate} will be printed. Remove expiry date` : 'Expiry date not added. Add expiry date from the GRN batch'}
              onClick={handleExpDateClick}
              className={`group/exp flex-1 min-w-0 h-full flex items-center gap-2.5 xl:gap-3 px-1.5 xl:px-2 rounded-ui-lg text-left cursor-pointer select-none aria-disabled:cursor-not-allowed ${FOCUS_RING} ${
                isStatActive ? 'opacity-40' : ''
              }`}
            >
              <span
                className={`shrink-0 hidden sm:flex w-10 h-10 rounded-full items-center justify-center transition-colors ${
                  expiryDate
                    ? 'bg-success-soft text-success'
                    : expirySelected
                      ? 'bg-warning-soft text-warning'
                      : 'bg-surface-2 text-muted group-hover/exp:bg-primary-soft group-hover/exp:text-primary'
                }`}
                aria-hidden="true"
              >
                {expiryDate ? <CalendarCheck size={20} /> : expirySelected ? <CalendarX2 size={20} /> : <CalendarPlus size={20} />}
              </span>
              <span className="min-w-0 flex flex-col justify-center leading-tight">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Expiry date</span>
                {expiryDate
                  ? <span className="mt-0.5 text-sm xl:text-base font-bold text-fg tabular truncate">{`${expiryDate}${expiryIsTestValue ? ' (test)' : ''}`}</span>
                  : expirySelected
                    ? <span className="mt-0.5 text-sm xl:text-base font-semibold text-warning truncate">Not retrieved</span>
                    : <span className="mt-0.5 text-sm xl:text-base font-semibold text-subtle truncate">Not added · <span className="text-primary">Tap to add</span></span>}
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
              className={`h-11 min-w-11 px-2.5 xl:px-3 rounded-ui bg-surface border border-border hover:bg-primary-soft hover:border-primary-border hover:text-primary text-muted flex items-center justify-center gap-1.5 text-sm font-semibold transition-all cursor-pointer shrink-0 active:scale-95 aria-disabled:opacity-40 aria-disabled:cursor-not-allowed ${FOCUS_RING}`}
              title="Choose the batch"
              aria-label="Choose the batch for the expiry date"
              aria-disabled={isStatFlow || undefined}
              aria-describedby={isStatFlow ? 'bottom-stat-lock' : undefined}
            >
              <Layers size={18} aria-hidden="true" />
              <span className="hidden xl:inline" aria-hidden="true">Batch</span>
            </button>
          </div>
        </div>

        {/* Label navigation */}
        <div className="h-full">
          <div className="w-full h-full bg-page border border-border rounded-ui-lg px-1.5 sm:px-2 flex items-center justify-between gap-1 shadow-card">
            <button
              type="button"
              disabled={isPrevDisabled}
              onClick={() => selectLabel(activeLabelIndex - 1)}
              aria-label="Previous label"
              aria-keyshortcuts="PageUp"
              title="Previous label (Page Up)"
              aria-describedby={isStatFlow ? 'bottom-stat-lock' : undefined}
              className={`${NAV_BUTTON} ${isPrevDisabled ? NAV_BUTTON_OFF : NAV_BUTTON_ON}`}
            >
              <ChevronLeft size={24} strokeWidth={2.5} aria-hidden="true" />
            </button>

            <span className="flex flex-col items-center gap-1.5 min-w-0">
              <span aria-live="polite" className="font-bold text-sm sm:text-base text-fg select-none text-center whitespace-nowrap tabular">
                Label {activeLabelIndex + 1} / {totalLabels}
              </span>
              {/* Position dots: one per label, the current one stretched. Hidden for a long list. */}
              {totalLabels > 1 && totalLabels <= 12 && (
                <span className="hidden sm:flex items-center gap-1" aria-hidden="true">
                  {Array.from({ length: totalLabels }, (_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${i === activeLabelIndex ? 'w-4 bg-primary' : 'w-1.5 bg-border-strong'}`}
                    />
                  ))}
                </span>
              )}
            </span>

            <button
              type="button"
              disabled={isNextDisabled}
              onClick={() => selectLabel(activeLabelIndex + 1)}
              aria-label="Next label"
              aria-keyshortcuts="PageDown"
              title="Next label (Page Down)"
              aria-describedby={isStatFlow ? 'bottom-stat-lock' : undefined}
              className={`${NAV_BUTTON} ${isNextDisabled ? NAV_BUTTON_OFF : NAV_BUTTON_ON}`}
            >
              <ChevronRight size={24} strokeWidth={2.5} aria-hidden="true" />
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
            className={`group w-full h-full bg-primary-solid text-on-primary-solid rounded-ui-lg pl-3 pr-4 sm:pl-4 sm:pr-5 flex items-center gap-3 sm:gap-4 shadow-card transition-all select-none touch-manipulation cursor-pointer active:scale-[0.99] ${FOCUS_RING} ${
              isStatActive ? 'opacity-40 cursor-not-allowed shadow-none active:scale-100' : 'hover:bg-primary-solid-hover active:bg-primary-solid-active'
            }`}
          >
            <span aria-hidden="true" className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/15 ring-1 ring-white/25 flex items-center justify-center shrink-0">
              <Check size={22} strokeWidth={3} className="text-on-primary-solid" />
            </span>

            <span aria-hidden="true" className="flex-1 min-w-0 flex flex-col items-start leading-none">
              <span className="font-extrabold text-xl sm:text-2xl tracking-wide text-on-primary-solid">DONE</span>
              <span className="mt-1 text-xs font-medium text-on-primary-solid/85 truncate">
                Review &amp; print labels
              </span>
            </span>

            {/* Keyboard hint on wide screens, then the forward arrow. */}
            <kbd aria-hidden="true" className="hidden xl:inline-flex items-center gap-1 px-2 py-1 rounded-ui bg-white/15 ring-1 ring-white/20 text-[11px] font-semibold font-sans text-on-primary-solid/90">
              Ctrl <span className="text-sm leading-none">↵</span>
            </kbd>
            <ChevronRight size={26} strokeWidth={2.5} className="text-on-primary-solid shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <span id="bottom-stat-lock" className="sr-only">{STAT_LOCK_HINT}</span>
    </footer>
  );
}
