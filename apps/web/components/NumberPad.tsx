'use client';

import React from 'react';
import { useLabelStore } from '../store/labelStore';
import { Delete, Check, Hash } from 'lucide-react';

export function NumberPad() {
  const { 
    numberPad, 
    appendDigit, 
    backspace, 
    allClear, 
    confirmNumberPad, 
    cancelNumberPad,
    setQuickFraction
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

  const activeControlLabel = numberPad.targetControl 
    ? numberPad.targetControl.replace('_', ' ').toUpperCase() 
    : 'INPUT';

  return (
    <div className="flex flex-col h-full select-none touch-manipulation overflow-hidden p-1">
      {/* Target Control Header Indicator */}
      <div className="flex items-center justify-between mb-2.5 bg-[#EFF6FF] border border-[#BFDBFE] px-4 py-2.5 rounded-2xl shadow-sm shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-sm shrink-0">
            <Hash size={18} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider leading-none">
              Entering
            </span>
            <span className="text-sm font-black text-[#2563EB] tracking-wide leading-tight mt-0.5">
              {activeControlLabel}
            </span>
          </div>
        </div>

        {/* Value Display Box */}
        <div className="bg-white border border-[#DCE7F5] px-4 py-1 rounded-xl shadow-sm min-w-[85px] text-right">
          <span className="text-2xl font-black text-[#0F172A] leading-tight">
            {numberPad.buffer || '0'}
          </span>
        </div>
      </div>

      {/* QUICK FRACTIONS PANEL IF FRACTION TARGET */}
      {isFractionTarget && (
        <div className="mb-2.5 grid grid-cols-4 gap-2.5 shrink-0">
          {['1/4', '1/2', '3/4', '1'].map((frac) => (
            <button
              key={frac}
              type="button"
              onClick={() => setQuickFraction(frac)}
              className="h-11 bg-white border border-[#DCE7F5] text-[#2563EB] hover:bg-[#EFF6FF] hover:border-[#BFDBFE] active:scale-95 font-black text-base rounded-xl shadow-sm transition-all select-none touch-manipulation cursor-pointer flex items-center justify-center"
            >
              {frac}
            </button>
          ))}
        </div>
      )}

      {/* 4x4 Keypad Grid */}
      <div className="flex-1 grid grid-cols-4 grid-rows-4 gap-2.5 min-h-0">
        <NumBtn onClick={() => handleDigit('7')}>7</NumBtn>
        <NumBtn onClick={() => handleDigit('8')}>8</NumBtn>
        <NumBtn onClick={() => handleDigit('9')}>9</NumBtn>
        <ActionBtn onClick={allClear} color="red">AC</ActionBtn>

        <NumBtn onClick={() => handleDigit('4')}>4</NumBtn>
        <NumBtn onClick={() => handleDigit('5')}>5</NumBtn>
        <NumBtn onClick={() => handleDigit('6')}>6</NumBtn>
        <ActionBtn onClick={backspace} color="gray">
          <Delete size={24} />
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
          className="col-span-2 bg-[#059669] hover:bg-[#047857] active:scale-[0.99] text-white font-black text-xl lg:text-2xl rounded-2xl shadow-md transition-all select-none touch-manipulation cursor-pointer flex items-center justify-center gap-2"
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
      className="bg-white border border-[#DCE7F5] text-[#0F172A] font-black text-2xl lg:text-3xl rounded-2xl hover:bg-[#F8FAFC] hover:border-[#BFDBFE] active:scale-95 transition-all flex items-center justify-center select-none touch-manipulation shadow-[0_2px_6px_rgba(15,23,42,0.02)] cursor-pointer"
    >
      {children}
    </button>
  );
}

function ActionBtn({ children, onClick, color }: { children: React.ReactNode, onClick: () => void, color: 'red' | 'gray' }) {
  const colorClass = color === 'red' 
    ? 'bg-[#FFF1F2] border border-[#FECDD3] text-[#E11D48] hover:bg-[#FFE4E6]' 
    : 'bg-[#F1F5F9] border border-[#E2E8F0] text-[#475569] hover:bg-[#E2E8F0]';
    
  return (
    <button 
      type="button"
      onClick={onClick}
      className={`font-black text-base lg:text-lg rounded-2xl transition-all flex items-center justify-center select-none touch-manipulation active:scale-95 shadow-sm cursor-pointer ${colorClass}`}
    >
      {children}
    </button>
  );
}
