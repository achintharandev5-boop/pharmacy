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
        <div className="w-8 h-8 rounded-ui-lg bg-surface border border-border text-muted flex items-center justify-center shadow-sm">
          <Clock size={18} />
        </div>
        <div>
          <h3 className="text-base font-bold text-fg leading-tight">
            STAT Follow-Up
          </h3>
          <p className="sr-only">
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
            className="h-14 bg-page hover:bg-surface hover:border-border text-muted hover:text-muted border border-border font-bold text-xs lg:text-sm rounded-ui-lg active:scale-95 flex items-center justify-center p-2 text-center transition-all shadow-sm cursor-pointer"
          >
            {opt}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-2 pt-2 border-t border-border shrink-0">
        <button 
          type="button"
          onClick={cancelStat}
          className="w-full h-14 bg-surface-2 hover:bg-border active:scale-95 text-muted font-bold text-sm rounded-ui-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <X size={16} />
          <span>Cancel STAT</span>
        </button>
      </div>
    </div>
  );
}
