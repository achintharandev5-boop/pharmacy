'use client';

import React from 'react';
import { useLabelStore, CALENDAR_DAYS } from '../../store/labelStore';
import { Calendar, CheckCircle2, Circle, Check, X } from 'lucide-react';

const DAYS_OF_WEEK = CALENDAR_DAYS;

export function DaysOfWeekPanel() {
  const { selectedDaysOfWeek, toggleDayOfWeek, closeDaysOfWeekPanel } = useLabelStore();

  const isAllSelected = DAYS_OF_WEEK.every((d) => selectedDaysOfWeek.includes(d));

  const handleToggleAll = () => {
    const store = useLabelStore.getState();
    const idx = store.activeLabelIndex;
    const current = store.labels[idx];
    if (current) {
      const newDays = isAllSelected ? [] : [...DAYS_OF_WEEK];
      const updated = { ...current, selectedDaysOfWeek: newDays };
      const updatedLabels = [...store.labels];
      updatedLabels[idx] = updated;
      useLabelStore.setState({
        labels: updatedLabels,
        selectedDaysOfWeek: newDays,
      });
    }
  };

  return (
    <div className="w-full h-full flex flex-col justify-between p-3 select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shadow-sm">
            <Calendar size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0F172A] leading-tight">
              Select Days
            </h3>
            <p className="text-xs text-[#94A3B8] font-medium leading-tight">
              Choose the medication administration schedule
            </p>
          </div>
        </div>

        {/* Quick select all toggle */}
        <button
          type="button"
          onClick={handleToggleAll}
          className="px-3 py-1 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] text-xs font-bold transition-colors cursor-pointer select-none"
        >
          {isAllSelected ? 'Clear All' : 'Select All'}
        </button>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0 my-1 overflow-y-auto pr-0.5">
        {DAYS_OF_WEEK.map((day, index) => {
          const isActive = selectedDaysOfWeek.includes(day);
          const isSunday = day === 'SUNDAY';

          return (
            <button
              key={day}
              type="button"
              onClick={() => toggleDayOfWeek(day)}
              className={`rounded-xl border flex items-center justify-between px-4 py-2.5 transition-all select-none touch-manipulation cursor-pointer ${
                isSunday ? 'col-span-2' : ''
              } ${
                isActive
                  ? 'bg-[#EFF6FF] border-2 border-[#2563EB] text-[#2563EB] shadow-sm'
                  : 'bg-white border-[#DCE7F5] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
              }`}
            >
              <span className="font-bold text-sm tracking-wide">
                {day}
              </span>

              {isActive ? (
                <CheckCircle2 size={20} className="text-[#2563EB] shrink-0 fill-blue-50" />
              ) : (
                <Circle size={20} className="text-[#CBD5E1] shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Action Footer */}
      <div className="flex items-center gap-2.5 shrink-0 mt-2 pt-2 border-t border-[#DCE7F5]">
        <button
          type="button"
          onClick={closeDaysOfWeekPanel}
          className="h-12 px-5 bg-[#F1F5F9] hover:bg-[#E2E8F0] active:scale-95 text-[#475569] font-bold text-sm rounded-xl transition-all select-none touch-manipulation cursor-pointer flex items-center justify-center gap-1.5"
        >
          <X size={16} />
          <span>Cancel</span>
        </button>

        <button
          type="button"
          onClick={closeDaysOfWeekPanel}
          className="flex-1 h-12 bg-[#059669] hover:bg-[#047857] active:scale-[0.99] text-white font-bold text-base rounded-xl shadow-sm transition-all select-none touch-manipulation cursor-pointer flex items-center justify-center gap-2"
        >
          <Check size={20} strokeWidth={2.5} />
          <span>ENTER</span>
        </button>
      </div>
    </div>
  );
}
