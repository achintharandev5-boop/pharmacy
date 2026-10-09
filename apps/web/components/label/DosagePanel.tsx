'use client';

import React, { useState } from 'react';
import { useLabelStore } from '../../store/labelStore';
import { ReasonsPanel } from '../../app/label/ReasonsPanel';
import { Pill, ChevronDown, Minus, Plus } from 'lucide-react';

function formatDisplayQty(qty: number, isFraction: boolean): string {
  if (isFraction) {
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
  return qty.toString();
}

interface DosageRowProps {
  labelTitle: string;
  timeRange: string;
  icon: React.ReactNode;
  bgClass: string;
  borderClass: string;
  qtyValue: number;
  isFraction: boolean;
  isActive: boolean;
  onSelectRow: () => void;
  onOpenQtyPad: () => void;
  onOpenXYPad: () => void;
  onDecrement: () => void;
  onIncrement: () => void;
}

function DosageRowCard({
  labelTitle,
  timeRange,
  icon,
  bgClass,
  borderClass,
  qtyValue,
  isFraction,
  isActive,
  onSelectRow,
  onOpenQtyPad,
  onOpenXYPad,
  onDecrement,
  onIncrement,
}: DosageRowProps) {
  const displayQty = formatDisplayQty(qtyValue, isFraction);

  return (
    <div
      onClick={onSelectRow}
      aria-selected={isActive}
      className={`w-full flex-1 rounded-2xl border ${bgClass} ${borderClass} p-3 flex items-stretch gap-3 shadow-[0_2px_8px_rgba(15,23,42,0.02)] transition-all min-h-[110px] ${
        isActive ? 'ring-2 ring-[#2563EB]' : ''
      }`}
    >
      {/* 1. TIME BLOCK (~30%) */}
      <div 
        onClick={(e) => {
          e.stopPropagation();
          onOpenQtyPad();
        }}
        className="flex items-center gap-3.5 w-[30%] shrink-0 select-none cursor-pointer pl-1.5"
      >
        <div className="shrink-0 flex items-center justify-center">
          {icon}
        </div>
        <div className="flex flex-col justify-center min-w-0">
          <span className="font-black text-base lg:text-lg text-[#0F172A] tracking-wider leading-tight">
            {labelTitle}
          </span>
          <span className="text-xs text-[#94A3B8] font-semibold leading-tight mt-1">
            {timeRange}
          </span>
        </div>
      </div>

      {/* 2. QTY COLUMN (~12%) */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onOpenQtyPad();
        }}
        className="flex flex-col items-center justify-center w-[12%] shrink-0 select-none cursor-pointer px-1"
      >
        <span className="text-xs font-bold text-[#94A3B8] uppercase text-center leading-none">
          QTY
        </span>
        <span className="font-black text-3xl lg:text-4xl text-[#0F172A] text-center leading-none mt-1.5">
          {displayQty}
        </span>
      </div>

      {/* 3. X / Y FRACTION COLUMN (~20%) */}
      <div className="flex flex-col items-center justify-center w-[20%] shrink-0 select-none px-1 h-full py-0.5">
        <span className="text-xs font-bold text-[#94A3B8] uppercase text-center leading-none mb-1">
          X / Y
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenXYPad();
          }}
          aria-label={`Select ${labelTitle} fraction`}
          className="w-full h-[64px] lg:h-[72px] bg-white border-2 border-[#DCE7F5] hover:border-[#2563EB] active:scale-95 rounded-2xl flex items-center justify-between px-3.5 text-lg lg:text-xl font-black text-[#0F172A] shadow-sm transition-all cursor-pointer select-none touch-manipulation"
        >
          <span>{isFraction ? displayQty : '1 / 1'}</span>
          <ChevronDown size={20} strokeWidth={2.5} className="text-[#94A3B8] shrink-0" />
        </button>
      </div>

      {/* 4. MINUS BUTTON (~19%) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDecrement();
        }}
        aria-label={`Decrease ${labelTitle} dosage`}
        className="flex-1 rounded-2xl bg-[#EF4444] hover:bg-[#DC2626] active:bg-[#B91C1C] text-white flex items-center justify-center font-black shadow-sm transition-all select-none touch-manipulation cursor-pointer active:scale-95"
      >
        <Minus size={34} strokeWidth={3.5} />
      </button>

      {/* 5. PLUS BUTTON (~19%) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onIncrement();
        }}
        aria-label={`Increase ${labelTitle} dosage`}
        className="flex-1 rounded-2xl bg-[#10B981] hover:bg-[#059669] active:bg-[#047857] text-white flex items-center justify-center font-black shadow-sm transition-all select-none touch-manipulation cursor-pointer active:scale-95"
      >
        <Plus size={34} strokeWidth={3.5} />
      </button>
    </div>
  );
}

export function DosagePanel() {
  const [selectedUnit, setSelectedUnit] = useState<'Units' | 'Tablets' | 'ML'>('Units');

  const activeControl = useLabelStore((state) => state.activeControl);
  const dosage = useLabelStore((state) => state.dosage);

  const setActiveControl = useLabelStore((state) => state.setActiveControl);
  const openNumberPad = useLabelStore((state) => state.openNumberPad);
  const incrementDosage = useLabelStore((state) => state.incrementDosage);
  const decrementDosage = useLabelStore((state) => state.decrementDosage);

  if (activeControl === 'oab_workflow') {
    return <ReasonsPanel />;
  }

  const times = [
    {
      key: 'morning' as const,
      title: 'MORNING',
      timeRange: '06:00 - 11:00',
      fractionKey: 'morning_fraction' as const,
      bgClass: 'bg-[#FFF9F2]',
      borderClass: 'border-[#FFE8D1]',
      icon: (
        <svg className="w-12 h-12 text-[#F59E0B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4.5" fill="#FEF3C7" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ),
    },
    {
      key: 'lunch' as const,
      title: 'LUNCH',
      timeRange: '11:00 - 16:00',
      fractionKey: 'lunch_fraction' as const,
      bgClass: 'bg-[#F8FBFF]',
      borderClass: 'border-[#E0EEFC]',
      icon: (
        <svg className="w-12 h-12 text-[#38BDF8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" fill="#E0F2FE" />
          <path d="M12 1v2" />
          <path d="M12 21v2" />
          <path d="M4.22 4.22l1.42 1.42" />
          <path d="M18.36 18.36l1.42 1.42" />
          <path d="M1 12h2" />
          <path d="M21 12h2" />
          <path d="M4.22 19.78l1.42-1.42" />
          <path d="M18.36 5.64l1.42-1.42" />
        </svg>
      ),
    },
    {
      key: 'night' as const,
      title: 'NIGHT',
      timeRange: '16:00 - 22:00',
      fractionKey: 'night_fraction' as const,
      bgClass: 'bg-[#FAF7FF]',
      borderClass: 'border-[#EFE8FD]',
      icon: (
        <svg className="w-12 h-12 text-[#8B5CF6]" viewBox="0 0 24 24" fill="#EDE9FE" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="w-full h-full bg-white border border-[#DCE7F5] rounded-2xl p-4 shadow-[0_2px_8px_rgba(15,23,42,0.03)] flex flex-col justify-between flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] shadow-sm">
            <Pill size={16} />
          </div>
          <h2 className="text-base font-bold text-[#0F172A] leading-none">
            Dosage Schedule
          </h2>
        </div>

        {/* Units segmented pill */}
        <div className="bg-[#F1F5F9] p-1 rounded-xl flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSelectedUnit('Units')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedUnit === 'Units'
                ? 'bg-[#2563EB] text-white shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Units
          </button>
          <button
            type="button"
            onClick={() => setSelectedUnit('Tablets')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedUnit === 'Tablets'
                ? 'bg-[#2563EB] text-white shadow-sm font-bold'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Tablets
          </button>
          <button
            type="button"
            onClick={() => setSelectedUnit('ML')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedUnit === 'ML'
                ? 'bg-[#2563EB] text-white shadow-sm font-bold'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            ML
          </button>
        </div>
      </div>

      {/* 3 Dosage Rows */}
      <div className="flex-1 flex flex-col justify-between gap-3 min-h-0">
        {times.map((t) => {
          const entry = dosage[t.key];
          const isActive = activeControl === t.key || activeControl === t.fractionKey;

          return (
            <DosageRowCard
              key={t.key}
              labelTitle={t.title}
              timeRange={t.timeRange}
              icon={t.icon}
              bgClass={t.bgClass}
              borderClass={t.borderClass}
              qtyValue={entry.qty}
              isFraction={entry.isFraction}
              isActive={isActive}
              onSelectRow={() => setActiveControl(t.key)}
              onOpenQtyPad={() => openNumberPad(t.key)}
              onOpenXYPad={() => openNumberPad(t.fractionKey)}
              onDecrement={() => decrementDosage(t.key)}
              onIncrement={() => incrementDosage(t.key)}
            />
          );
        })}
      </div>
    </div>
  );
}
