'use client';

import React from 'react';
import { useLabelStore } from '../../store/labelStore';
import { NumberPad } from '../NumberPad';
import { StatPanel } from '../StatPanel';
import { StatFollowUpPanel } from '../StatFollowUpPanel';
import { DaysOfWeekPanel } from '../../app/label/DaysOfWeekPanel';
import { SelectedInstructionsPanel } from './SelectedInstructionsPanel';
import { OABWorkflowPanel } from '../OABWorkflowPanel';
import {
  MessageSquareText,
  MapPinOff,
  Calendar,
  CirclePlus,
  Trash2,
  Utensils,
  Pill,
  GlassWater,
  Clock,
  CalendarCheck,
  Sunset,
  RefreshCcw,
  ChevronsRight,
  Zap,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  CircleDot,
  Smile,
} from 'lucide-react';

interface InstructionGridProps {
  validationError?: string | null;
}

export function InstructionGrid({ validationError }: InstructionGridProps) {
  const activeControl = useLabelStore((state) => state.activeControl);
  const numberPad = useLabelStore((state) => state.numberPad);
  const selectedDaysOfWeek = useLabelStore((state) => state.selectedDaysOfWeek);
  const additionalInstructions = useLabelStore((state) => state.additionalInstructions);
  const reason = useLabelStore((state) => state.reason);
  const reasons = useLabelStore((state) => state.reasons);
  const expiryDate = useLabelStore((state) => state.expiryDate);
  const stat = useLabelStore((state) => state.stat);
  const showAddress = useLabelStore((state) => state.showAddress);
  const toggleShowAddress = useLabelStore((state) => state.toggleShowAddress);
  const toggleAdditionalInstruction = useLabelStore((state) => state.toggleAdditionalInstruction);
  const openDaysOfWeekPanel = useLabelStore((state) => state.openDaysOfWeekPanel);
  const startStat = useLabelStore((state) => state.startStat);
  const openExpDateModal = useLabelStore((state) => state.openExpDateModal);
  const openDeleteLabelModal = useLabelStore((state) => state.openDeleteLabelModal);
  const addLabel = useLabelStore((state) => state.addLabel);
  const setActiveControl = useLabelStore((state) => state.setActiveControl);

  const isStatActive = (activeControl as string) === 'stat';

  // Sub-panel check
  const showSubPanel =
    activeControl === 'days_of_week' ||
    activeControl === 'oab_workflow' ||
    numberPad.visible ||
    activeControl === 'stat' ||
    activeControl === 'stat_followup';

  const isReasonsActive = (reasons && reasons.length > 0) || Boolean(reason) || additionalInstructions.includes('REASONS');
  const isAddressHidden = !showAddress;
  const isExpDateActive = Boolean(expiryDate) || additionalInstructions.includes('ADD EXP DATE');
  const isStatSelected = Boolean(stat) || additionalInstructions.includes('STAT') || (activeControl as string) === 'stat';

  const handleTileClick = (key: string) => {
    if (key === 'REASONS') {
      toggleAdditionalInstruction('REASONS');
      setActiveControl('oab_workflow');
    } else if (key === 'REMOVE ADDRESS') {
      toggleShowAddress();
    } else if (key === 'ADD EXP DATE') {
      openExpDateModal();
    } else if (key === 'DELETE LABEL') {
      openDeleteLabelModal();
    } else if (key === 'ADD LABEL') {
      addLabel();
    } else if (key === 'STAT') {
      startStat();
    } else {
      toggleAdditionalInstruction(key);
    }
  };

  const daysLabel =
    selectedDaysOfWeek.length > 0
      ? selectedDaysOfWeek
          .map((d) => d.charAt(0) + d.slice(1, 3).toLowerCase())
          .join(', ')
      : 'Name of Days';

  return (
    <div className="w-full h-full flex flex-col justify-between gap-2.5 overflow-hidden min-w-0">
      {/* 1. SELECTED INSTRUCTIONS CARD */}
      <SelectedInstructionsPanel validationError={validationError} />

      {/* 2. 5x4 INSTRUCTION GRID CARD OR SUB-PANELS (Moves immediately below Selected Instructions) */}
      <div className="bg-white border border-[#DCE7F5] rounded-2xl p-3 shadow-[0_2px_8px_rgba(15,23,42,0.03)] flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
        {activeControl === 'days_of_week' ? (
          <DaysOfWeekPanel />
        ) : activeControl === 'oab_workflow' ? (
          <OABWorkflowPanel />
        ) : numberPad.visible ? (
          <NumberPad />
        ) : activeControl === 'stat' ? (
          <StatPanel />
        ) : activeControl === 'stat_followup' ? (
          <StatFollowUpPanel />
        ) : (
          <div
            className="grid grid-cols-5 gap-2 h-full w-full"
            style={{
              gridTemplateRows: 'repeat(4, minmax(0, 1fr))',
            }}
          >
            {/* ROW 1 */}
            {/* 1. Reasons */}
            <button
              type="button"
              onClick={() => handleTileClick('REASONS')}
              className={`rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer ${
                isReasonsActive
                  ? 'bg-[#EFF6FF] border-2 border-[#2563EB] text-[#2563EB] shadow-sm'
                  : 'bg-white border-[#E2ECF8] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
              }`}
            >
              <MessageSquareText size={24} className="text-[#2563EB] mb-1 shrink-0" />
              <span className="font-bold text-xs leading-tight">Reasons</span>
            </button>

            {/* 2. Till Date */}
            <button
              type="button"
              onClick={() => handleTileClick('TILL DATE')}
              className={`rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer ${
                additionalInstructions.includes('TILL DATE')
                  ? 'bg-[#F0FDFA] border-2 border-[#0D9488] text-[#0D9488] shadow-sm'
                  : 'bg-white border-[#E2ECF8] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
              }`}
            >
              <CalendarDays size={24} className="text-[#0D9488] mb-1 shrink-0" />
              <span className="font-bold text-xs leading-tight">Till Date</span>
            </button>

            {/* 3. 5H */}
            <button
              type="button"
              onClick={() => handleTileClick('5H')}
              className={`rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer ${
                additionalInstructions.includes('5H')
                  ? 'bg-[#EFF6FF] border-2 border-[#2563EB] text-[#2563EB] shadow-sm'
                  : 'bg-white border-[#E2ECF8] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
              }`}
            >
              <Clock size={24} className="text-[#2563EB] mb-1 shrink-0" />
              <span className="font-bold text-xs leading-tight">5H</span>
            </button>

            {/* 4. Evening */}
            <button
              type="button"
              onClick={() => handleTileClick('EVENING')}
              className={`rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer ${
                additionalInstructions.includes('EVENING')
                  ? 'bg-[#FFF7ED] border-2 border-[#EA580C] text-[#EA580C] shadow-sm'
                  : 'bg-white border-[#E2ECF8] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
              }`}
            >
              <Sunset size={24} className="text-[#F97316] mb-1 shrink-0" />
              <span className="font-bold text-xs leading-tight">Evening</span>
            </button>

            {/* 5. 6H */}
            <button
              type="button"
              onClick={() => handleTileClick('6H')}
              className={`rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer ${
                additionalInstructions.includes('6H')
                  ? 'bg-[#EFF6FF] border-2 border-[#2563EB] text-[#2563EB] shadow-sm'
                  : 'bg-white border-[#E2ECF8] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
              }`}
            >
              <Clock size={24} className="text-[#2563EB] mb-1 shrink-0" />
              <span className="font-bold text-xs leading-tight">6H</span>
            </button>

            {/* ROW 2 */}
            {/* 6. Remove Address */}
            <button
              type="button"
              onClick={() => handleTileClick('REMOVE ADDRESS')}
              className={`rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer ${
                isAddressHidden
                  ? 'bg-[#FFF1F2] border-2 border-[#E11D48] text-[#E11D48] shadow-sm'
                  : 'bg-white border-[#E2ECF8] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
              }`}
            >
              <MapPinOff size={24} className="text-[#E11D48] mb-1 shrink-0" />
              <span className="font-bold text-xs leading-tight">
                {isAddressHidden ? 'Address Hidden' : 'Remove Address'}
              </span>
            </button>

            {/* 7. And This Date */}
            <button
              type="button"
              onClick={() => handleTileClick('AND THIS DATE')}
              className={`rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer ${
                additionalInstructions.includes('AND THIS DATE')
                  ? 'bg-[#EFF6FF] border-2 border-[#2563EB] text-[#2563EB] shadow-sm'
                  : 'bg-white border-[#E2ECF8] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
              }`}
            >
              <CalendarPlus size={24} className="text-[#2563EB] mb-1 shrink-0" />
              <span className="font-bold text-xs leading-tight">And This Date</span>
            </button>

            {/* 8. Weekly */}
            <button
              type="button"
              onClick={() => handleTileClick('WEEKLY')}
              className={`rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer ${
                additionalInstructions.includes('WEEKLY')
                  ? 'bg-[#EFF6FF] border-2 border-[#2563EB] text-[#2563EB] shadow-sm'
                  : 'bg-white border-[#E2ECF8] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
              }`}
            >
              <RefreshCcw size={24} className="text-[#2563EB] mb-1 shrink-0" />
              <span className="font-bold text-xs leading-tight">Weekly</span>
            </button>

            {/* 9. STAT */}
            <button
              type="button"
              onClick={() => handleTileClick('STAT')}
              className={`rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer ${
                isStatSelected
                  ? 'bg-[#FFF1F2] border-2 border-[#FDA4AF] text-[#E11D48] shadow-sm'
                  : 'bg-white border-[#E2ECF8] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
              }`}
            >
              <Zap size={24} className="text-[#E11D48] mb-1 shrink-0 fill-current" />
              <span className="font-bold text-xs leading-tight text-[#E11D48]">STAT</span>
            </button>

            {/* 10. EOD */}
            <button
              type="button"
              onClick={() => handleTileClick('EOD')}
              className={`rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer ${
                additionalInstructions.includes('EOD')
                  ? 'bg-[#EFF6FF] border-2 border-[#2563EB] text-[#2563EB] shadow-sm'
                  : 'bg-white border-[#E2ECF8] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
              }`}
            >
              <ChevronsRight size={24} className="text-[#2563EB] mb-1 shrink-0" />
              <span className="font-bold text-xs leading-tight">EOD</span>
            </button>

            {/* ROW 3 */}
            {/* 11. EXP Date */}
            <button
              type="button"
              onClick={() => handleTileClick('ADD EXP DATE')}
              className={`rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer ${
                isExpDateActive
                  ? 'bg-[#2563EB] text-white border-2 border-[#1D4ED8] shadow-sm'
                  : 'bg-white border-[#E2ECF8] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
              }`}
            >
              <Calendar
                size={24}
                className={`mb-1 shrink-0 ${isExpDateActive ? 'text-white' : 'text-[#2563EB]'}`}
              />
              <span className={`font-bold text-xs leading-tight ${isExpDateActive ? 'text-white' : 'text-[#0F172A]'}`}>
                EXP Date
              </span>
              {expiryDate && (
                <span className={`text-[10px] font-medium leading-none mt-0.5 ${isExpDateActive ? 'text-blue-100' : 'text-[#2563EB]'}`}>
                  {expiryDate}
                </span>
              )}
            </button>

            {/* 12. Empty Stomach */}
            <button
              type="button"
              onClick={() => handleTileClick('EMPTY STOMACH')}
              className={`rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer ${
                additionalInstructions.includes('EMPTY STOMACH')
                  ? 'bg-[#FFFBEB] border-2 border-[#D97706] text-[#D97706] shadow-sm'
                  : 'bg-white border-[#E2ECF8] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
              }`}
            >
              <CircleDot size={24} className="text-[#EF4444] mb-1 shrink-0" />
              <span className="font-bold text-xs leading-tight">Empty Stomach</span>
            </button>

            {/* 13. With Food */}
            <button
              type="button"
              onClick={() => handleTileClick('WITH FOOD')}
              className={`rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer ${
                additionalInstructions.includes('WITH FOOD')
                  ? 'bg-[#F5F3FF] border-2 border-[#7C3AED] text-[#7C3AED] shadow-sm'
                  : 'bg-white border-[#E2ECF8] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
              }`}
            >
              <Utensils size={24} className="text-[#7C3AED] mb-1 shrink-0" />
              <span className="font-bold text-xs leading-tight">With Food</span>
            </button>

            {/* 14. Chewable */}
            <button
              type="button"
              onClick={() => handleTileClick('CHEWABLE')}
              className={`rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer ${
                additionalInstructions.includes('CHEWABLE')
                  ? 'bg-[#F5F3FF] border-2 border-[#7C3AED] text-[#7C3AED] shadow-sm'
                  : 'bg-white border-[#E2ECF8] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
              }`}
            >
              <Pill size={24} className="text-[#7C3AED] mb-1 shrink-0" />
              <span className="font-bold text-xs leading-tight">Chewable</span>
            </button>

            {/* 15. Daily */}
            <button
              type="button"
              onClick={() => handleTileClick('DAILY')}
              className={`rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer ${
                additionalInstructions.includes('DAILY')
                  ? 'bg-[#ECFDF5] border-2 border-[#059669] text-[#059669] shadow-sm'
                  : 'bg-white border-[#E2ECF8] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
              }`}
            >
              <CalendarCheck size={24} className="text-[#059669] mb-1 shrink-0" />
              <span className="font-bold text-xs leading-tight">Daily</span>
            </button>

            {/* ROW 4 */}
            {/* 16. Delete Label */}
            <button
              type="button"
              onClick={() => handleTileClick('DELETE LABEL')}
              className="rounded-xl border border-red-500 bg-[#EF4444] hover:bg-[#DC2626] active:scale-95 text-white flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer shadow-sm"
            >
              <Trash2 size={24} className="text-white mb-1 shrink-0" />
              <span className="font-bold text-xs leading-tight text-white">Delete Label</span>
            </button>

            {/* 17. Add Label */}
            <button
              type="button"
              onClick={() => handleTileClick('ADD LABEL')}
              className="rounded-xl border border-emerald-600 bg-[#059669] hover:bg-[#047857] active:scale-95 text-white flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer shadow-sm"
            >
              <CirclePlus size={24} className="text-white mb-1 shrink-0" />
              <span className="font-bold text-xs leading-tight text-white">Add Label</span>
            </button>

            {/* 18. Dissolve and Drink */}
            <button
              type="button"
              onClick={() => handleTileClick('DISSOLVE AND DRINK')}
              className={`rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer ${
                additionalInstructions.includes('DISSOLVE AND DRINK')
                  ? 'bg-[#EFF6FF] border-2 border-[#2563EB] text-[#2563EB] shadow-sm'
                  : 'bg-white border-[#E2ECF8] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
              }`}
            >
              <GlassWater size={24} className="text-[#2563EB] mb-1 shrink-0" />
              <span className="font-bold text-xs leading-tight">Dissolve and Drink</span>
            </button>

            {/* 19. Keep in Mouth */}
            <button
              type="button"
              onClick={() => handleTileClick('KEEP IN MOUTH')}
              className={`rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer ${
                additionalInstructions.includes('KEEP IN MOUTH')
                  ? 'bg-[#FFF1F2] border-2 border-[#E11D48] text-[#E11D48] shadow-sm'
                  : 'bg-white border-[#E2ECF8] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
              }`}
            >
              <Smile size={24} className="text-[#E11D48] mb-1 shrink-0" />
              <span className="font-bold text-xs leading-tight">Keep in Mouth</span>
            </button>

            {/* 20. 8H */}
            <button
              type="button"
              onClick={() => handleTileClick('8H')}
              className={`rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all duration-100 select-none touch-manipulation cursor-pointer ${
                additionalInstructions.includes('8H')
                  ? 'bg-[#F5F3FF] border-2 border-[#7C3AED] text-[#7C3AED] shadow-sm'
                  : 'bg-white border-[#E2ECF8] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
              }`}
            >
              <Clock size={24} className="text-[#7C3AED] mb-1 shrink-0" />
              <span className="font-bold text-xs leading-tight">8H</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. NAME OF DAYS FULL-WIDTH CONTROL */}
      <button
        type="button"
        disabled={isStatActive}
        onClick={() => openDaysOfWeekPanel()}
        aria-label="Select days of week"
        className={`w-full h-[52px] shrink-0 rounded-xl border border-[#D0E2FB] flex items-center justify-between px-4 text-sm font-bold tracking-wide transition-all select-none touch-manipulation cursor-pointer ${
          isStatActive ? 'opacity-40 pointer-events-none' : ''
        } ${
          selectedDaysOfWeek.length > 0
            ? 'bg-[#DBEAFE] text-[#1D4ED8] border-2 border-[#2563EB]'
            : 'bg-[#EEF4FE] hover:bg-[#E2EDFD] text-[#2563EB]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Calendar size={20} className="text-[#2563EB]" />
          <span>{daysLabel}</span>
        </div>
        <ChevronRight size={20} className="text-[#2563EB]" />
      </button>
    </div>
  );
}
