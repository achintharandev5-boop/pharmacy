'use client';
import React from 'react';
import { useLabelStore } from '../store/labelStore';
import { Zap, Minus, Plus, ChevronDown, Check, X } from 'lucide-react';

export function formatDosage(qty: number, isFraction: boolean) {
  if (!isFraction) return qty.toString();
  const whole = Math.floor(qty);
  const frac = qty - whole;
  let fracStr = '';
  if (Math.abs(frac - 0.5) < 0.01) fracStr = '½';
  else if (Math.abs(frac - 0.25) < 0.01) fracStr = '¼';
  else if (Math.abs(frac - 0.75) < 0.01) fracStr = '¾';
  else fracStr = frac > 0 ? ` ${frac.toFixed(2).replace('0.', '.')}` : '';
  
  if (whole === 0) return fracStr || '0';
  return `${whole}${fracStr}`;
}

export function StatPanel() {
  const { stat, incrementDosage, decrementDosage, openNumberPad, cancelStat, doneStat } = useLabelStore();

  const currentQty = stat?.qty || 0;
  const currentIsFrac = stat?.isFraction || false;
  const displayQty = formatDosage(currentQty, currentIsFrac);

  return (
    <div className="w-full h-full flex flex-col justify-between p-3 select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-2 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] text-[#E11D48] flex items-center justify-center shadow-sm">
          <Zap size={18} className="fill-current" />
        </div>
        <div>
          <h3 className="text-base font-bold text-[#0F172A] leading-tight">
            STAT Dose
          </h3>
          <p className="text-xs text-[#94A3B8] font-medium leading-tight">
            Immediate administration single dose
          </p>
        </div>
      </div>
      
      {/* Center QTY Box */}
      <div className="flex-1 bg-[#F8FAFC] border border-[#DCE7F5] rounded-2xl p-4 flex flex-col items-center justify-center gap-4 my-1">
        <div className="flex flex-col items-center justify-center">
          <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">
            STAT Quantity
          </span>
          <span className="text-4xl lg:text-5xl font-black text-[#0F172A] mt-1">
            {displayQty || '0'}
          </span>
        </div>
        
        {/* Controls row */}
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => openNumberPad('stat_fraction')}
            className="h-12 px-4 bg-white border border-[#DCE7F5] text-[#475569] hover:text-[#2563EB] hover:border-[#BFDBFE] rounded-xl font-bold text-sm flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <span>X / Y</span>
            <ChevronDown size={15} />
          </button>
          <button 
            type="button"
            onClick={() => decrementDosage('stat')}
            className="w-14 h-12 bg-[#EF4444] hover:bg-[#DC2626] active:scale-95 text-white rounded-xl font-bold text-2xl flex items-center justify-center shadow-sm transition-all cursor-pointer"
          >
            <Minus size={22} strokeWidth={3} />
          </button>
          <button 
            type="button"
            onClick={() => incrementDosage('stat')}
            className="w-14 h-12 bg-[#10B981] hover:bg-[#059669] active:scale-95 text-white rounded-xl font-bold text-2xl flex items-center justify-center shadow-sm transition-all cursor-pointer"
          >
            <Plus size={22} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2.5 mt-2 pt-2 border-t border-[#DCE7F5] shrink-0">
        <button 
          type="button"
          onClick={cancelStat}
          className="h-12 px-5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] font-bold text-sm rounded-xl active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <X size={16} />
          <span>Cancel</span>
        </button>
        <button 
          type="button"
          onClick={doneStat}
          className="flex-1 h-12 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.99] text-white font-bold text-base rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Check size={18} strokeWidth={2.5} />
          <span>Done (Next)</span>
        </button>
      </div>
    </div>
  );
}
