'use client';

import { formatDays, formatWeekdayRange, hasWeekdayRange } from '../../lib/nameOfDays';
import { dosageText } from '../../lib/dosageQuantity';
import { ENT_PREFIX, readEnt, entLocation, entInstructions } from '../../lib/ent';


import React, { useEffect, useState } from 'react';
import { useLabelStore, findInstructionConflicts, isStatStep } from '../../store/labelStore';
import { buildFinalInstruction, formatDosageReadable } from '../../lib/labelBuilder';
import { analyseLabel, QUANTITY_CODES } from '../../lib/instructionEngine';
import {
  Zap,
  Utensils,
  Clock,
  CalendarCheck,
  Sunset,
  RefreshCcw,
  MessageSquareText,
  MapPinOff,
  Pill,
  GlassWater,
  CalendarDays,
  Calendar,
  AlertTriangle,
  X,
  FileText,
  Trash2,
  CircleDot,
  Smile,
  ChevronsRight,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import { CATEGORY_STYLE, instructionCategory } from './instructionCategories';

interface SelectedInstructionsPanelProps {
  validationError?: string | null;
}

function formatQty(qty: number, isFraction: boolean): string {
  return dosageText(qty, isFraction);
}

/** Instruction code behind a chip key (instr_WEEKLY → WEEKLY); other chips use their own key. */
function chipCode(key: string): string {
  if (key.startsWith('instr_')) return key.slice('instr_'.length);
  if (key === 'stat') return 'STAT';
  if (key === 'address') return 'REMOVE ADDRESS';
  return key;
}

// Same icons as the action tiles, so a chip is recognisable next to the tile that made it.
const CHIP_ICONS: Record<string, LucideIcon> = {
  exp: Calendar, STAT: Zap, 'WITH FOOD': Utensils, 'EMPTY STOMACH': CircleDot, CHEWABLE: Pill,
  'DISSOLVE AND DRINK': GlassWater, 'KEEP IN MOUTH': Smile, DAILY: CalendarCheck, WEEKLY: RefreshCcw,
  EVENING: Sunset, EOD: ChevronsRight, '5H': Clock, '6H': Clock, '8H': Clock, 'REMOVE ADDRESS': MapPinOff,
  days: CalendarDays, 'weekday-range': CalendarDays, ent: Stethoscope,
};

function getChipIcon(key: string) {
  const code = chipCode(key);
  const Icon = key.startsWith('reason_') ? MessageSquareText : CHIP_ICONS[code] ?? FileText;
  return <Icon size={13} aria-hidden="true" className={CATEGORY_STYLE[instructionCategory(code)].icon} />;
}

function getChipStyle(key: string) {
  return CATEGORY_STYLE[instructionCategory(chipCode(key))].chip;
}

export function SelectedInstructionsPanel({ validationError }: SelectedInstructionsPanelProps) {
  const additionalInstructions = useLabelStore((state) => state.additionalInstructions);
  const stat = useLabelStore((state) => state.stat);
  const frequencyDosage = useLabelStore((state) => state.frequencyDosage);
  const reasons = useLabelStore((state) => state.reasons);
  const expiryDate = useLabelStore((state) => state.expiryDate);
  const showAddress = useLabelStore((state) => state.showAddress);
  const selectedDaysOfWeek = useLabelStore((state) => state.selectedDaysOfWeek);
  const activeLabel = useLabelStore((state) => state.labels[state.activeLabelIndex]);
  const customerName = useLabelStore((state) => state.customerName);
  const toggleAdditionalInstruction = useLabelStore((state) => state.toggleAdditionalInstruction);
  const toggleReason = useLabelStore((state) => state.toggleReason);
  const clearExpiry = useLabelStore((state) => state.clearExpiry);
  const expiryBatch = useLabelStore((state) => state.expiryBatch);
  const removeStat = useLabelStore((state) => state.removeStat);
  const toggleShowAddress = useLabelStore((state) => state.toggleShowAddress);
  const setDaysOfWeek = useLabelStore((state) => state.setDaysOfWeek);
  const clearLabelInstructions = useLabelStore((state) => state.clearLabelInstructions);
  // While a STAT dose is being entered, nothing here may change it underneath the panel.
  const editingStat = useLabelStore((state) => isStatStep(state.activeControl));

  // Clear All asks once more before removing everything on this label. The request belongs to
  // one label, so switching labels cancels it.
  const [confirmingFor, setConfirmingFor] = useState<string | null>(null);
  const confirmingClear = confirmingFor !== null && confirmingFor === activeLabel?.id;
  useEffect(() => {
    if (!confirmingFor) return;
    const timer = setTimeout(() => setConfirmingFor(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmingFor]);
  const setConfirmingClear = (on: boolean) => setConfirmingFor(on ? activeLabel?.id ?? null : null);
  const [showFullText, setShowFullText] = useState(false);

  // Build chips list, in the order they were chosen.
  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  for (const time of ['morning', 'lunch', 'night'] as const) {
    const entry = activeLabel?.dosage[time];
    if (entry && entry.qty > 0) {
      chips.push({
        key: `dose_${time}`,
        label: `${time.toUpperCase()}: ${formatQty(entry.qty, entry.isFraction)}`,
        onRemove: () => useLabelStore.getState().clearDosage(time),
      });
    }
  }

  const ent = readEnt(additionalInstructions);
  if (ent) {
    const sentences = entInstructions(ent, activeLabel?.dosage, { code: additionalInstructions.find(i => QUANTITY_CODES.includes(i)) || "", qty: frequencyDosage.qty });
    chips.push({ key: 'ent', label: sentences.join(' ') || `ENT: ${entLocation(ent)}`, onRemove: () => useLabelStore.getState().setEnt(null) });
  }

  if (expiryDate) {
    const source = expiryBatch?.source === 'ui-test' ? ' (UI test value, not GRN)' : expiryBatch?.batchNumber ? ` · Batch ${expiryBatch.batchNumber}` : '';
    chips.push({ key: 'exp', label: `EXP: ${expiryDate}${source}`, onRemove: clearExpiry });
  }

  if (stat) {
    chips.push({
      key: 'stat',
      label: `STAT${stat.qty > 0 ? `: ${formatQty(stat.qty, stat.isFraction)}` : ''}${
        stat.administration?.length ? ` ${stat.administration.join(' ')}` : ''
      }${
        stat.followUp ? ` (${stat.followUp})` : ''
      }`,
      onRemove: removeStat,
    });
  }

  (reasons || []).forEach((r) => {
    chips.push({ key: `reason_${r}`, label: r, onRemove: () => toggleReason(r) });
  });

  additionalInstructions
    .filter((i) => !i.startsWith(ENT_PREFIX) && i !== 'REASONS' && i !== 'ADD EXP DATE' && i !== 'STAT' && i !== 'TILL TO DAY')
    .forEach((instr) => {
      const perDose = instr === 'WEEKLY' && (activeLabel?.weeklyDosage?.qty ?? 0) > 0 ? `: ${formatDosageReadable(activeLabel!.weeklyDosage!.qty, activeLabel!.weeklyDosage!.isFraction)}` : QUANTITY_CODES.includes(instr) && frequencyDosage.qty > 0
        ? `: ${formatDosageReadable(frequencyDosage.qty, frequencyDosage.isFraction)} each`
        : '';
      chips.push({ key: `instr_${instr}`, label: `${instr}${perDose}`, onRemove: () => toggleAdditionalInstruction(instr) });
    });

  if (!showAddress) {
    chips.push({ key: 'address', label: 'ADDRESS HIDDEN', onRemove: toggleShowAddress });
  }

  if (activeLabel && hasWeekdayRange(activeLabel)) {
    chips.push({ key: 'weekday-range', label: formatWeekdayRange(activeLabel.weekdayRange) || 'Till to the Day: choose and confirm endpoints', onRemove: () => useLabelStore.getState().toggleWeekdayRange() });
  }
  if (selectedDaysOfWeek.length > 0) {
    chips.push({
      key: 'days',
      label: formatDays(selectedDaysOfWeek) || 'Correct invalid weekday selections',
      onRemove: () => setDaysOfWeek([]),
    });
  }

  const conflicts = findInstructionConflicts(additionalInstructions);
  const workflowNotice = useLabelStore((state) => state.workflowNotice);
  // Pending-approval notices (spec wording only), e.g. no approved wording for Morning only.
  const labelNotices = activeLabel ? analyseLabel(activeLabel).notices : [];

  // The exact text the label builder produces for this label (what is saved and printed).
  const built = activeLabel ? buildFinalInstruction({ ...activeLabel, customerName }) : null;
  const labelText = built?.finalInstructionText ?? '';

  const handleClearAll = () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    setConfirmingClear(false);
    clearLabelInstructions();
  };

  return (
    <div className="w-full bg-page border border-border rounded-ui-lg px-2.5 py-1.5 shadow-card flex flex-col gap-1.5 shrink-0">
      {built?.productTypePrintingError && (
        <div role="alert" className="flex items-start gap-2 text-danger font-bold text-xs bg-danger-soft border border-danger-border rounded-lg px-2 py-1.5">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{built.productTypePrintingError}</span>
        </div>
      )}
      {validationError && (
        <div role="alert" className="flex items-start gap-2 text-danger font-bold text-xs bg-danger-soft border border-danger-border rounded-lg px-2 py-1.5">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {workflowNotice && (
        <div role="alert" data-testid="workflow-notice" className="flex items-start gap-2 text-danger font-bold text-xs bg-danger-soft border border-danger-border rounded-lg px-2 py-1.5">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{workflowNotice}</span>
        </div>
      )}

      {labelNotices.map((n) => (
        <div key={n} data-testid="label-notice" className="flex items-start gap-2 text-warning font-bold text-xs bg-warning-soft border border-warning-border rounded-lg px-2 py-1.5">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{n}</span>
        </div>
      ))}

      {conflicts.map((c) => (
        <div key={c} role="status" className="flex items-start gap-2 text-warning font-bold text-xs bg-warning-soft border border-warning-border rounded-lg px-2 py-1.5">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{c}</span>
        </div>
      ))}

      {/* Caption, the chips (they wrap onto further lines; nothing scrolls or is hidden), Clear All. */}
      <div className="flex items-start gap-2 min-w-0">
        <h2 className="shrink-0 h-10 flex items-center text-xs font-bold uppercase tracking-wide text-subtle leading-none">
          Selected<span className="sr-only"> instructions</span>
        </h2>
        <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap" aria-label="Selected instructions">
          {chips.length > 0 ? (
            chips.map((chip) => (
              <span
                key={chip.key}
                className={`inline-flex max-w-full items-center gap-1.5 pl-3 pr-0 min-h-10 rounded-full text-sm font-semibold border ${getChipStyle(chip.key)} shadow-sm select-none`}
              >
                {getChipIcon(chip.key)}
                <span className="min-w-0 break-words leading-tight py-1">{chip.label}</span>
                <button
                  type="button"
                  onClick={chip.onRemove}
                  disabled={editingStat}
                  aria-label={`Remove ${chip.label}`}
                  className="w-10 h-10 shrink-0 hover:bg-surface-2 active:bg-surface-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed rounded-full flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X size={15} strokeWidth={2.5} aria-hidden="true" />
                </button>
              </span>
            ))
          ) : (
            <span className="h-10 flex items-center text-subtle text-sm font-medium">None</span>
          )}
        </div>

        {chips.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            disabled={editingStat}
            className={`shrink-0 h-10 px-3 rounded-ui-lg font-bold text-sm flex items-center gap-1.5 transition-colors cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              confirmingClear
                ? 'bg-danger text-[var(--color-on-danger)]'
                : 'bg-primary-soft hover:bg-primary-border text-primary'
            }`}
          >
            <Trash2 size={15} aria-hidden="true" />
            <span>{confirmingClear ? 'Tap again to clear' : 'Clear All'}</span>
          </button>
        )}
      </div>

      {labelText && (
        <div className="flex items-start gap-2 border-t border-border pt-1.5">
          <p
            id="label-text-preview"
            data-testid="label-text-preview"
            className={`flex-1 min-w-0 text-xs text-muted leading-snug select-text ${showFullText ? '' : 'line-clamp-2'}`}
            title={labelText}
          >
            <span className="font-bold text-subtle uppercase tracking-wide mr-1.5">Label</span>
            {/* The printed wording, in the print typeface; Sinhala is marked for screen readers. */}
            <span lang="si" className="sinhala-text text-[13px] text-fg">{labelText}</span>
          </p>
          <button
            type="button"
            onClick={() => setShowFullText(!showFullText)}
            aria-expanded={showFullText}
            aria-controls="label-text-preview"
            className="h-10 px-3 shrink-0 rounded-ui-lg text-xs font-bold text-primary hover:bg-primary-soft cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {showFullText ? 'Less' : 'More'}<span className="sr-only"> label text</span>
          </button>
        </div>
      )}
    </div>
  );
}
