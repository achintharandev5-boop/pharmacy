'use client';

import React from 'react';
import { useLabelStore } from '../../store/labelStore';
import {
  CalendarClock,
  Zap,
  Utensils,
  Clock,
  CalendarCheck,
  Sunset,
  RefreshCcw,
  ChevronsRight,
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
} from 'lucide-react';

interface SelectedInstructionsPanelProps {
  validationError?: string | null;
}

function formatQty(qty: number, isFraction: boolean): string {
  if (isFraction) {
    const whole = Math.floor(qty);
    const frac = qty - whole;
    let fracStr = '';
    if (Math.abs(frac - 0.5) < 0.01) fracStr = '½';
    else if (Math.abs(frac - 0.25) < 0.01) fracStr = '¼';
    else if (Math.abs(frac - 0.75) < 0.01) fracStr = '¾';
    else fracStr = frac > 0 ? ` ${frac.toFixed(2).replace('0.', '.')}` : '';
    if (whole === 0) return fracStr.trim() || '0';
    return `${whole}${fracStr}`;
  }
  return qty.toString();
}

function getChipIcon(key: string) {
  if (key.startsWith('EXP')) return <Calendar size={13} className="text-[#2563EB]" />;
  if (key.includes('STAT')) return <Zap size={13} className="text-[#E11D48]" />;
  if (key.includes('FOOD')) return <Utensils size={13} className="text-[#7C3AED]" />;
  if (key.includes('EMPTY')) return <MessageSquareText size={13} className="text-[#D97706]" />;
  if (key.includes('TILL') || key.includes('AND THIS')) return <CalendarDays size={13} className="text-[#0D9488]" />;
  if (key.includes('DAILY')) return <CalendarCheck size={13} className="text-[#059669]" />;
  if (key.includes('WEEKLY')) return <RefreshCcw size={13} className="text-[#2563EB]" />;
  if (key.includes('EVENING')) return <Sunset size={13} className="text-[#F97316]" />;
  if (key.includes('CHEWABLE') || key.includes('MOUTH')) return <Pill size={13} className="text-[#7C3AED]" />;
  if (key.includes('DISSOLVE')) return <GlassWater size={13} className="text-[#2563EB]" />;
  if (key.includes('ADDRESS')) return <MapPinOff size={13} className="text-[#E11D48]" />;
  if (key.includes('EOD') || key.includes('5H') || key.includes('6H') || key.includes('8H')) {
    return <Clock size={13} className="text-[#2563EB]" />;
  }
  return <FileText size={13} className="text-[#2563EB]" />;
}

function getChipStyle(key: string) {
  if (key.includes('STAT') || key.includes('ADDRESS')) {
    return 'bg-[#FFF1F2] border-[#FECDD3] text-[#E11D48]';
  }
  if (key.includes('FOOD') || key.includes('CHEWABLE') || key.includes('MOUTH') || key.includes('TAKE')) {
    return 'bg-[#F5F3FF] border-[#DDD6FE] text-[#7C3AED]';
  }
  if (key.includes('DAILY') || key.includes('AFTER') || key.includes('DISSOLVE')) {
    return 'bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]';
  }
  if (key.includes('EMPTY') || key.includes('EVENING') || key.includes('BEFORE')) {
    return 'bg-[#FFFBEB] border-[#FDE68A] text-[#D97706]';
  }
  return 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8]';
}

export function SelectedInstructionsPanel({ validationError }: SelectedInstructionsPanelProps) {
  const additionalInstructions = useLabelStore((state) => state.additionalInstructions);
  const dosage = useLabelStore((state) => state.dosage);
  const frequencyDosage = useLabelStore((state) => state.frequencyDosage);
  const stat = useLabelStore((state) => state.stat);
  const reason = useLabelStore((state) => state.reason);
  const reasons = useLabelStore((state) => state.reasons);
  const expiryDate = useLabelStore((state) => state.expiryDate);
  const toggleAdditionalInstruction = useLabelStore((state) => state.toggleAdditionalInstruction);
  const toggleReason = useLabelStore((state) => state.toggleReason);
  const setExpiryDate = useLabelStore((state) => state.setExpiryDate);
  const clearReasons = useLabelStore((state) => state.clearReasons);
  const allClear = useLabelStore((state) => state.allClear);

  const FREQUENCY_BTNS = ['STAT', 'SOS', '6H', '8H', '5H', 'EOD', 'DAILY', 'EVENING'];
  const activeFreq = additionalInstructions.find((i) => FREQUENCY_BTNS.includes(i));

  // Build chips list
  const chips: { key: string; label: string; onRemove?: () => void }[] = [];

  // Expiry date chip
  if (expiryDate) {
    chips.push({
      key: 'exp',
      label: `EXP: ${expiryDate}`,
      onRemove: () => setExpiryDate(null),
    });
  }

  // STAT chip
  if (stat && (stat.qty > 0 || stat.isFraction || additionalInstructions.includes('STAT'))) {
    chips.push({
      key: 'stat',
      label: `STAT${stat.qty > 0 ? `: ${formatQty(stat.qty, stat.isFraction)}` : ''}${
        stat.followUp ? ` (${stat.followUp})` : ''
      }`,
      onRemove: () => toggleAdditionalInstruction('STAT'),
    });
  }

  // Reasons chips
  if (reasons && reasons.length > 0) {
    reasons.forEach((r) => {
      chips.push({
        key: `reason_${r}`,
        label: r,
        onRemove: () => toggleReason(r),
      });
    });
  } else if (reason) {
    chips.push({
      key: 'reason',
      label: reason,
      onRemove: () => clearReasons(),
    });
  }

  // Other instruction chips
  const otherInstructions = additionalInstructions.filter(
    (i) => i !== 'REASONS' && i !== 'ADD EXP DATE' && i !== 'STAT'
  );
  otherInstructions.forEach((instr) => {
    chips.push({
      key: `instr_${instr}`,
      label: instr,
      onRemove: () => toggleAdditionalInstruction(instr),
    });
  });

  const handleClearAll = () => {
    // Clear selected instructions while retaining current product
    const store = useLabelStore.getState();
    const idx = store.activeLabelIndex;
    const current = store.labels[idx];
    if (current) {
      const updated = {
        ...current,
        additionalInstructions: [],
        reasons: [],
        reason: null,
        stat: null,
        expiryDate: null,
        selectedDaysOfWeek: [],
      };
      const updatedLabels = [...store.labels];
      updatedLabels[idx] = updated;
      useLabelStore.setState({
        labels: updatedLabels,
        additionalInstructions: [],
        reasons: [],
        reason: null,
        stat: null,
        expiryDate: null,
        selectedDaysOfWeek: [],
      });
    }
  };

  return (
    <div className="w-full bg-white border border-[#DCE7F5] rounded-2xl p-3 shadow-[0_2px_8px_rgba(15,23,42,0.03)] flex flex-col justify-between shrink-0 min-h-[74px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#2563EB] flex items-center justify-center text-white shadow-sm shrink-0">
            <FileText size={15} />
          </div>
          <h2 className="text-sm font-bold text-[#0F172A] leading-none">
            Selected Instructions
          </h2>
        </div>

        {chips.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="px-2.5 py-1 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer select-none"
          >
            <Trash2 size={13} />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* Validation alert or Chips row */}
      {validationError ? (
        <div className="flex items-center gap-2 text-[#E11D48] font-bold text-xs py-1">
          <AlertTriangle size={15} className="shrink-0" />
          <span className="truncate">{validationError}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto">
          {chips.length > 0 ? (
            chips.map((chip) => {
              const icon = getChipIcon(chip.label);
              const colorClasses = getChipStyle(chip.label);

              return (
                <span
                  key={chip.key}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${colorClasses} shadow-sm shrink-0 select-none`}
                >
                  {icon}
                  <span>{chip.label}</span>
                  {chip.onRemove && (
                    <button
                      type="button"
                      onClick={chip.onRemove}
                      aria-label={`Remove ${chip.label}`}
                      className="ml-0.5 hover:opacity-75 cursor-pointer rounded-full p-0.5"
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  )}
                </span>
              );
            })
          ) : (
            <span className="text-[#94A3B8] text-xs font-medium italic py-0.5">
              No instructions selected
            </span>
          )}
        </div>
      )}
    </div>
  );
}
