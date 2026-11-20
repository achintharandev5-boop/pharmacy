'use client';

import React from 'react';
import { reasonValuesProblem } from '../../lib/reasons';
import { useLabelStore } from '../../store/labelStore';
import { CheckCircle2, Circle, ArrowLeft, Trash2, Check } from 'lucide-react';

interface ReasonButtonProps {
  reasonText: string;
  isSelected: boolean;
  onSelect: () => void;
}

function ReasonButton({ reasonText, isSelected, onSelect }: ReasonButtonProps) {
  const isEnglish = !/[\u0D80-\u0DFF]/.test(reasonText);
  const textClass = isEnglish
    ? 'text-base lg:text-lg font-bold font-sans'
    : 'text-lg lg:text-xl font-bold sinhala-text';

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`min-h-[58px] p-3 px-4 rounded-xl flex items-center justify-between text-left transition-all select-none touch-manipulation active:scale-[0.99] border cursor-pointer ${
        // Shared selected treatment: tint, 2 px border and a check (not colour alone).
        isSelected
          ? 'bg-primary-soft text-fg border-2 border-primary shadow-sm font-bold'
          : 'bg-page text-fg border-border hover:bg-surface hover:border-primary-border'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
    >
      <span lang={isEnglish ? undefined : 'si'} className={`flex-1 min-w-0 break-words leading-snug tracking-tight ${textClass}`}>
        {reasonText}
      </span>
      {isSelected ? (
        <CheckCircle2 size={22} aria-hidden="true" className="text-primary shrink-0 ml-2" />
      ) : (
        <Circle size={22} aria-hidden="true" className="text-border-strong shrink-0 ml-2" />
      )}
    </button>
  );
}

export function ReasonsPanel() {
  const catalogue = useLabelStore(state => state.reasonCatalogue);
  const cancelReasonsPanel = useLabelStore(state => state.cancelReasonsPanel);
  const reason = useLabelStore((state) => state.reason);
  const reasons = useLabelStore((state) => state.reasons);
  const toggleReason = useLabelStore((state) => state.toggleReason);
  const clearReasons = useLabelStore((state) => state.clearReasons);
  const closeReasonsPanel = useLabelStore((state) => state.closeReasonsPanel);

  const selectedReasons = reasons?.length ? reasons : (reason ? [reason] : []);
  const problem = reasonValuesProblem(selectedReasons) || (!catalogue ? 'Reason catalogue unavailable. Use Back to continue without selecting reasons.' : selectedReasons.some(r => !catalogue.includes(r)) ? 'Remove unavailable selections before confirming.' : null);
  const unavailable = selectedReasons.filter(r => !catalogue?.includes(r));

  const handleToggle = (r: string) => {
    toggleReason(r);
  };

  const handleClear = () => {
    clearReasons();
  };

  // Enter confirms; Back restores the original selections.
  const handleDone = () => {
    closeReasonsPanel();
  };

  return (
    <div className="flex-1 flex flex-col bg-page rounded-2xl overflow-hidden h-full min-h-0 select-none">
      {/* HEADER */}
      <div className="bg-surface border-b border-border p-3 xl:px-4 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 xl:gap-3 min-w-0">
          <button
            type="button"
            onClick={cancelReasonsPanel}
            className="h-12 px-3 xl:px-3.5 bg-page hover:bg-surface shrink-0 active:scale-95 border border-border text-fg font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-fg leading-none whitespace-nowrap">
                Reason for Use
              </h2>
              {selectedReasons.length > 0 && (
                <span className="text-xs bg-primary text-[var(--color-on-solid)] px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                  {selectedReasons.length} Selected
                </span>
              )}
            </div>
            <p className="sr-only">
              Select reasons for this label (multiple allowed)
            </p>
          </div>
        </div>

        {/* HEADER ACTIONS */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClear}
            disabled={selectedReasons.length === 0}
            aria-label="Omit reasons"
            className={`h-12 px-3.5 xl:px-3.5 border font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer active:scale-95 ${
              selectedReasons.length > 0
                ? 'bg-danger-soft text-danger border-danger-border hover:bg-danger-soft'
                : 'bg-surface text-subtle border-border opacity-60 pointer-events-none'
            }`}
          >
            <Trash2 size={14} />
            <span className="hidden xl:inline whitespace-nowrap">Omit reasons</span>
          </button>

          <button
            type="button"
            onClick={handleDone}
            disabled={Boolean(problem) || selectedReasons.length === 0}
            className="disabled:opacity-40 disabled:cursor-not-allowed h-12 px-5 xl:px-5 bg-success hover:bg-success active:scale-95 text-[var(--color-on-solid)] font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 touch-manipulation shadow-sm cursor-pointer"
          >
            <Check size={16} strokeWidth={2.5} />
            <span>Enter</span>
          </button>
        </div>
      </div>

      {/* 2-COLUMN REASON GRID */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 grid grid-cols-1 md:grid-cols-2 gap-2.5 auto-rows-max bg-page">
        {catalogue?.length === 0 && <p className="col-span-full">No reasons configured. Ask an administrator to add reasons in Admin → Edit Reasons.</p>}
        {problem && <p role="alert" className="col-span-full text-danger text-sm">{problem}</p>}
        {unavailable.map((text, index) => <button type="button" key={`unavailable-${index}`} onClick={() => toggleReason(text)} className="col-span-full border border-danger p-3 rounded-xl text-left break-words">Remove unavailable selection: {text}</button>)}
        {(catalogue ?? []).map((r, i) => (
          <ReasonButton
            key={i}
            reasonText={r}
            isSelected={selectedReasons.includes(r)}
            onSelect={() => handleToggle(r)}
          />
        ))}
      </div>
    </div>
  );
}
