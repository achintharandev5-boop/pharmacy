'use client';

import React from 'react';
import { useLabelStore } from '../../store/labelStore';
import { HARDCODED_PRODUCTS } from '../../constants/products';
import { Calendar, Check, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';

interface BottomActionBarProps {
  onDone: () => void;
}

export function BottomActionBar({ onDone }: BottomActionBarProps) {
  const activeControl = useLabelStore((state) => state.activeControl);
  const isStatActive = (activeControl as string) === 'stat';

  const selectLabel = useLabelStore((state) => state.selectLabel);
  const openNumberPad = useLabelStore((state) => state.openNumberPad);
  const openExpDateModal = useLabelStore((state) => state.openExpDateModal);

  const activeLabelIndex = useLabelStore((state) => state.activeLabelIndex);
  const totalLabels = useLabelStore((state) => state.labels.length);
  const days = useLabelStore((state) => state.days);
  const expiryDate = useLabelStore((state) => state.expiryDate);
  const setExpiryDate = useLabelStore((state) => state.setExpiryDate);
  const product = useLabelStore((state) => state.product);

  const daysNum = days ?? 5; // Default 5 if null as shown in reference design

  const handleExpDateClick = () => {
    if (expiryDate) {
      setExpiryDate(null);
    } else {
      let foundDate: string | null = null;
      if (product) {
        const matched = HARDCODED_PRODUCTS.find(
          (p) => p.id === product.id || p.name.toLowerCase() === product.name.toLowerCase()
        );
        foundDate = matched?.expiry_date || null;
      }
      if (!foundDate) {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        foundDate = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
      }
      setExpiryDate(foundDate);
    }
  };

  const handleDaysDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    const store = useLabelStore.getState();
    const newDays = Math.max(1, (store.days ?? 5) - 1);
    const idx = store.activeLabelIndex;
    const labels = [...store.labels];
    if (labels[idx]) {
      labels[idx] = { ...labels[idx], days: newDays };
      useLabelStore.setState({ labels, days: newDays });
    }
  };

  const handleDaysIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    const store = useLabelStore.getState();
    const newDays = (store.days ?? 5) + 1;
    const idx = store.activeLabelIndex;
    const labels = [...store.labels];
    if (labels[idx]) {
      labels[idx] = { ...labels[idx], days: newDays };
      useLabelStore.setState({ labels, days: newDays });
    }
  };

  const isPrevDisabled = isStatActive || activeLabelIndex <= 0;
  const isNextDisabled = isStatActive || activeLabelIndex >= totalLabels - 1;

  return (
    <footer className="w-full shrink-0 select-none" style={{ height: '76px' }}>
      <div
        className="w-full h-full grid items-stretch gap-2.5"
        style={{
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1.8fr) minmax(0, 2.2fr) minmax(0, 2.4fr)',
        }}
      >
        {/* 1. DAYS CARD */}
        <div className="h-full">
          <div
            className={`w-full h-full bg-white border border-[#DCE7F5] rounded-2xl px-4 flex items-center justify-between shadow-[0_2px_8px_rgba(15,23,42,0.03)] ${
              isStatActive ? 'opacity-40 pointer-events-none' : ''
            }`}
          >
            {/* Calendar Icon */}
            <div className="shrink-0 flex items-center text-[#2563EB]">
              <Calendar size={24} />
            </div>

            {/* Middle Controls Stack */}
            <div className="flex flex-col items-center justify-center">
              <span className="text-[11px] font-bold text-[#94A3B8] uppercase leading-none">
                Days
              </span>
              <div className="flex items-center gap-1 mt-1">
                <button
                  type="button"
                  onClick={handleDaysDecrement}
                  aria-label="Decrease days"
                  className="w-7 h-7 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] active:scale-95 text-[#64748B] flex items-center justify-center font-bold text-sm select-none touch-manipulation cursor-pointer transition-all"
                >
                  <Minus size={14} strokeWidth={2.5} />
                </button>

                <button
                  type="button"
                  onClick={() => openNumberPad('days')}
                  aria-label={`Days: ${daysNum}`}
                  className="min-w-[28px] px-1 text-center font-black text-lg text-[#0F172A] hover:text-[#2563EB] cursor-pointer"
                >
                  {daysNum}
                </button>

                <button
                  type="button"
                  onClick={handleDaysIncrement}
                  aria-label="Increase days"
                  className="w-7 h-7 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] active:scale-95 text-[#2563EB] flex items-center justify-center font-bold text-sm select-none touch-manipulation cursor-pointer transition-all"
                >
                  <Plus size={14} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <div className="w-6 shrink-0" />
          </div>
        </div>

        {/* 2. EXPIRY DATE CARD */}
        <div className="h-full">
          <div
            onClick={handleExpDateClick}
            className={`w-full h-full bg-white border border-[#DCE7F5] rounded-2xl px-4 flex items-center justify-between shadow-[0_2px_8px_rgba(15,23,42,0.03)] hover:border-[#BFDBFE] transition-colors cursor-pointer select-none ${
              isStatActive ? 'opacity-40 pointer-events-none' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="shrink-0 flex items-center text-[#7C3AED]">
                <Calendar size={24} />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-[11px] font-semibold text-[#94A3B8] uppercase leading-none">
                  Expiry Date
                </span>
                <span className="font-black text-base text-[#0F172A] leading-tight mt-0.5">
                  {expiryDate || '1/8/2028'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openExpDateModal();
              }}
              className="w-9 h-9 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-sm"
              title="Open Expiry Date Picker"
            >
              <Calendar size={18} />
            </button>
          </div>
        </div>

        {/* 3. LABEL NAVIGATION CARD */}
        <div className="h-full">
          <div className="w-full h-full bg-white border border-[#DCE7F5] rounded-2xl px-4 flex items-center justify-between shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <button
              type="button"
              disabled={isPrevDisabled}
              onClick={() => selectLabel(activeLabelIndex - 1)}
              aria-label="Previous label"
              className={`w-10 h-10 rounded-xl bg-[#F0F6FF] hover:bg-[#E0EEFC] active:scale-95 text-[#2563EB] flex items-center justify-center font-bold transition-all cursor-pointer ${
                isPrevDisabled ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              <ChevronLeft size={22} strokeWidth={2.5} />
            </button>

            <span className="font-black text-sm text-[#2563EB] tracking-wider uppercase select-none">
              LABEL {activeLabelIndex + 1} OF {totalLabels}
            </span>

            <button
              type="button"
              disabled={isNextDisabled}
              onClick={() => selectLabel(activeLabelIndex + 1)}
              aria-label="Next label"
              className={`w-10 h-10 rounded-xl bg-[#F0F6FF] hover:bg-[#E0EEFC] active:scale-95 text-[#2563EB] flex items-center justify-center font-bold transition-all cursor-pointer ${
                isNextDisabled ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              <ChevronRight size={22} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* 4. DONE CTA CARD */}
        <div className="h-full">
          <button
            type="button"
            onClick={onDone}
            disabled={isStatActive}
            aria-label="Done — review and print labels"
            className={`w-full h-full bg-[#059669] hover:bg-[#047857] active:bg-[#065F46] text-white rounded-2xl px-6 flex items-center justify-between shadow-md transition-all select-none touch-manipulation cursor-pointer active:scale-[0.99] ${
              isStatActive ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
            }`}
          >
            {/* Left: White Check in Circle */}
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Check size={22} strokeWidth={3} className="text-white" />
            </div>

            {/* Center: Title + Subtext */}
            <div className="flex flex-col items-center justify-center text-center">
              <span className="font-black text-2xl tracking-wider leading-none text-white">
                DONE
              </span>
              <span className="text-xs font-medium text-emerald-100 leading-tight mt-1">
                Review &amp; Print Labels
              </span>
            </div>

            {/* Right: Chevron */}
            <ChevronRight size={26} strokeWidth={2.5} className="text-white shrink-0" />
          </button>
        </div>
      </div>
    </footer>
  );
}
