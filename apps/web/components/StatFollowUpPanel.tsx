'use client';
import React from 'react';
import { useLabelStore } from '../store/labelStore';
import { STAT_FOLLOWUP_OPTIONS } from '../constants/instructions';
import { Clock, X } from 'lucide-react';

export function StatFollowUpPanel() {
  const { setStatFollowUp, cancelStat } = useLabelStore();

  return (
    <div className="w-full h-full flex flex-col justify-between p-3 select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-2 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-[#F5F3FF] border border-[#DDD6FE] text-[#7C3AED] flex items-center justify-center shadow-sm">
          <Clock size={18} />
        </div>
        <div>
          <h3 className="text-base font-bold text-[#0F172A] leading-tight">
            STAT Follow-Up
          </h3>
          <p className="text-xs text-[#94A3B8] font-medium leading-tight">
            Choose routine schedule to follow after STAT dose
          </p>
        </div>
      </div>
      
      {/* Options grid */}
      <div className="flex-1 grid grid-cols-3 gap-2 overflow-y-auto pr-1 my-1">
        {STAT_FOLLOWUP_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setStatFollowUp(opt)}
            className="h-12 bg-white hover:bg-[#F5F3FF] hover:border-[#C4B5FD] text-[#475569] hover:text-[#7C3AED] border border-[#DCE7F5] font-bold text-xs lg:text-sm rounded-xl active:scale-95 flex items-center justify-center p-2 text-center transition-all shadow-sm cursor-pointer"
          >
            {opt}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-2 pt-2 border-t border-[#DCE7F5] shrink-0">
        <button 
          type="button"
          onClick={cancelStat}
          className="w-full h-12 bg-[#F1F5F9] hover:bg-[#E2E8F0] active:scale-95 text-[#475569] font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <X size={16} />
          <span>Cancel STAT</span>
        </button>
      </div>
    </div>
  );
}
