import React from 'react';
import { useLabelStore } from '../../store/labelStore';
import { CheckCircle2, Circle, ArrowLeft, Trash2, Check, MessageSquare } from 'lucide-react';

const REASONS_LIST = [
  "වේදනාව ඇති විට පමණක් ගන්න",
  "වමනයට",
  "තද උණට",
  "සෙමට",
  "බඩේ කැක්කුමට",
  "සෙම්ප්‍රතිශ්‍යාවට",
  "කැස්සට",
  "නොනවත්වා බඩ යන විට",
  "ALLERGIC",
  "දත් වේදනාවට",
];

interface ReasonButtonProps {
  reasonText: string;
  isSelected: boolean;
  onSelect: () => void;
}

function ReasonButton({ reasonText, isSelected, onSelect }: ReasonButtonProps) {
  const isEnglish = !/[\u0D80-\u0DFF]/.test(reasonText);
  const textClass = isEnglish
    ? 'text-base lg:text-lg font-bold font-sans'
    : 'text-lg lg:text-xl font-bold font-serif';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`min-h-[58px] p-3 px-4 rounded-xl flex items-center justify-between text-left transition-all select-none touch-manipulation active:scale-[0.99] border cursor-pointer ${
        isSelected
          ? 'bg-[#EFF6FF] text-[#2563EB] border-2 border-[#2563EB] shadow-sm font-bold'
          : 'bg-white text-[#0F172A] border-[#DCE7F5] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
      }`}
    >
      <span className={`flex-1 leading-snug tracking-tight ${textClass}`}>
        {reasonText}
      </span>
      {isSelected ? (
        <CheckCircle2 size={20} className="text-[#2563EB] shrink-0 ml-2 fill-blue-50" />
      ) : (
        <Circle size={20} className="text-[#CBD5E1] shrink-0 ml-2" />
      )}
    </button>
  );
}

export function ReasonsPanel() {
  const reason = useLabelStore((state) => state.reason);
  const reasons = useLabelStore((state) => state.reasons);
  const toggleReason = useLabelStore((state) => state.toggleReason);
  const clearReasons = useLabelStore((state) => state.clearReasons);
  const toggleAdditionalInstruction = useLabelStore((state) => state.toggleAdditionalInstruction);

  const selectedReasons = reasons || (reason ? [reason] : []);

  const handleToggle = (r: string) => {
    toggleReason(r);
  };

  const handleClear = () => {
    clearReasons();
  };

  const handleDone = () => {
    toggleAdditionalInstruction('REASONS');
  };

  return (
    <div className="flex-1 flex flex-col bg-white rounded-2xl overflow-hidden h-full min-h-0 select-none">
      {/* HEADER */}
      <div className="bg-[#F8FAFC] border-b border-[#DCE7F5] p-3 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDone}
            className="h-10 px-3.5 bg-white hover:bg-slate-100 active:scale-95 border border-[#DCE7F5] text-[#0F172A] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#0F172A] leading-none">
                Reason for Use
              </h2>
              {selectedReasons.length > 0 && (
                <span className="text-xs bg-[#2563EB] text-white px-2 py-0.5 rounded-full font-bold">
                  {selectedReasons.length} Selected
                </span>
              )}
            </div>
            <p className="text-xs text-[#94A3B8] font-medium mt-0.5">
              Select reasons for this label (multiple allowed)
            </p>
          </div>
        </div>

        {/* HEADER ACTIONS */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClear}
            className={`h-10 px-3.5 border font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer active:scale-95 ${
              selectedReasons.length > 0
                ? 'bg-[#FFF1F2] text-[#E11D48] border-[#FECDD3] hover:bg-[#FFE4E6]'
                : 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 pointer-events-none'
            }`}
          >
            <Trash2 size={14} />
            <span>Clear All</span>
          </button>

          <button
            type="button"
            onClick={handleDone}
            className="h-10 px-5 bg-[#059669] hover:bg-[#047857] active:scale-95 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 touch-manipulation shadow-sm cursor-pointer"
          >
            <Check size={16} strokeWidth={2.5} />
            <span>Done</span>
          </button>
        </div>
      </div>

      {/* 2-COLUMN REASON GRID */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 grid grid-cols-1 md:grid-cols-2 gap-2.5 auto-rows-max bg-white">
        {REASONS_LIST.map((r, i) => (
          <ReasonButton
            key={i}
            reasonText={r}
            isSelected={selectedReasons.includes(r)}
            onSelect={() => handleToggle(r)}
          />
        ))}
      </div>
    </div>
  );
}
