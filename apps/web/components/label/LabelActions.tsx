'use client';

import React from 'react';
import { useLabelStore } from '../../store/labelStore';
import { Hand, User, Clock, Pill } from 'lucide-react';

export function LabelActions() {
  const additionalInstructions = useLabelStore((state) => state.additionalInstructions);
  const activeControl = useLabelStore((state) => state.activeControl);
  const toggleAdditionalInstruction = useLabelStore((state) => state.toggleAdditionalInstruction);

  const isStatActive = (activeControl as string) === 'stat';
  const hasLockedTiming =
    additionalInstructions.includes('WITH FOOD') ||
    additionalInstructions.includes('EMPTY STOMACH');

  const isGiveSelected = additionalInstructions.includes('GIVE');
  const isTakeSelected = additionalInstructions.includes('TAKE');
  const isBeforeSelected = additionalInstructions.includes('BEFORE');
  const isAfterSelected = additionalInstructions.includes('AFTER');

  return (
    <div className="w-full bg-white border border-[#DCE7F5] rounded-2xl p-3.5 shadow-[0_2px_8px_rgba(15,23,42,0.03)] shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-md bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] shadow-sm">
          <Pill size={14} />
        </div>
        <span className="text-sm font-bold text-[#0F172A] leading-none">
          Administration
        </span>
      </div>

      {/* 4 Equal Buttons Grid */}
      <div className="grid grid-cols-4 gap-2.5">
        {/* 1. GIVE (Blue) */}
        <button
          type="button"
          disabled={isStatActive}
          onClick={() => toggleAdditionalInstruction('GIVE')}
          aria-pressed={isGiveSelected}
          aria-label="Give medication"
          className={`h-13 rounded-xl border flex items-center justify-center gap-2 font-bold text-sm transition-all select-none touch-manipulation cursor-pointer active:scale-95 ${
            isGiveSelected
              ? 'bg-[#DBEAFE] border-2 border-[#2563EB] text-[#1D4ED8] shadow-sm'
              : 'bg-[#F0F6FF] border-[#D6E6FE] text-[#2563EB] hover:bg-[#E5F0FF]'
          } ${isStatActive ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
        >
          <Hand size={20} className="text-[#2563EB] shrink-0" />
          <span>GIVE</span>
        </button>

        {/* 2. TAKE (Purple) */}
        <button
          type="button"
          disabled={isStatActive}
          onClick={() => toggleAdditionalInstruction('TAKE')}
          aria-pressed={isTakeSelected}
          aria-label="Take medication"
          className={`h-13 rounded-xl border flex items-center justify-center gap-2 font-bold text-sm transition-all select-none touch-manipulation cursor-pointer active:scale-95 ${
            isTakeSelected
              ? 'bg-[#EDE9FE] border-2 border-[#7C3AED] text-[#6D28D9] shadow-sm'
              : 'bg-[#F7F3FF] border-[#EDE4FE] text-[#7C3AED] hover:bg-[#EFE8FE]'
          } ${isStatActive ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
        >
          <User size={20} className="text-[#7C3AED] shrink-0" />
          <span>TAKE</span>
        </button>

        {/* 3. BEFORE (Orange) */}
        <button
          type="button"
          disabled={isStatActive || hasLockedTiming}
          onClick={() => toggleAdditionalInstruction('BEFORE')}
          aria-pressed={isBeforeSelected}
          aria-label="Take before meals"
          className={`h-13 rounded-xl border flex items-center justify-center gap-2 font-bold text-sm transition-all select-none touch-manipulation cursor-pointer active:scale-95 ${
            isBeforeSelected
              ? 'bg-[#FFEDD5] border-2 border-[#EA580C] text-[#C2410C] shadow-sm'
              : 'bg-[#FFF7ED] border-[#FFEDD5] text-[#EA580C] hover:bg-[#FFEDD5]'
          } ${
            isStatActive || hasLockedTiming
              ? 'opacity-40 cursor-not-allowed pointer-events-none bg-[#F8FAFC] border-[#E2E8F0] text-[#94A3B8]'
              : ''
          }`}
        >
          <Clock size={20} className="text-[#EA580C] shrink-0" />
          <span>BEFORE</span>
        </button>

        {/* 4. AFTER (Green) */}
        <button
          type="button"
          disabled={isStatActive || hasLockedTiming}
          onClick={() => toggleAdditionalInstruction('AFTER')}
          aria-pressed={isAfterSelected}
          aria-label="Take after meals"
          className={`h-13 rounded-xl border flex items-center justify-center gap-2 font-bold text-sm transition-all select-none touch-manipulation cursor-pointer active:scale-95 ${
            isAfterSelected
              ? 'bg-[#DCFCE7] border-2 border-[#16A34A] text-[#15803D] shadow-sm'
              : 'bg-[#F0FDF4] border-[#DCFCE7] text-[#16A34A] hover:bg-[#DCFCE7]'
          } ${
            isStatActive || hasLockedTiming
              ? 'opacity-40 cursor-not-allowed pointer-events-none bg-[#F8FAFC] border-[#E2E8F0] text-[#94A3B8]'
              : ''
          }`}
        >
          <Clock size={20} className="text-[#16A34A] shrink-0" />
          <span>AFTER</span>
        </button>
      </div>
    </div>
  );
}
