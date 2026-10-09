'use client';

import React from 'react';
import { useLabelStore } from '../../store/labelStore';
import { Trash2, X } from 'lucide-react';

export function DeleteLabelModal() {
  const deleteLabelModalVisible = useLabelStore((state) => state.deleteLabelModalVisible);
  const closeDeleteLabelModal = useLabelStore((state) => state.closeDeleteLabelModal);
  const confirmDeleteActiveLabel = useLabelStore((state) => state.confirmDeleteActiveLabel);
  const activeLabelIndex = useLabelStore((state) => state.activeLabelIndex);
  const totalLabels = useLabelStore((state) => state.labels.length);

  if (!deleteLabelModalVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-[#DCE7F5] shadow-2xl overflow-hidden w-[460px] max-w-full flex flex-col p-6 relative">
        {/* Close icon button */}
        <button
          type="button"
          onClick={closeDeleteLabelModal}
          className="absolute top-4 right-4 w-8 h-8 rounded-full text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] flex items-center justify-center transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Danger Icon Badge */}
        <div className="w-14 h-14 rounded-2xl bg-[#FFF1F2] border border-[#FECDD3] text-[#E11D48] flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Trash2 size={26} strokeWidth={2.5} />
        </div>

        {/* Title & Body */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-[#0F172A] leading-tight">
            Delete Label {activeLabelIndex + 1} of {totalLabels}?
          </h2>
          <p className="text-sm font-medium text-[#64748B] mt-2 leading-relaxed px-2">
            {totalLabels > 1
              ? 'This medicine label will be permanently removed from this prescription session.'
              : 'This will reset the current medicine label to an empty state.'}
          </p>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          <button
            type="button"
            onClick={closeDeleteLabelModal}
            className="h-12 bg-[#F1F5F9] hover:bg-[#E2E8F0] active:scale-95 text-[#475569] font-bold text-sm rounded-xl transition-all select-none touch-manipulation cursor-pointer flex items-center justify-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmDeleteActiveLabel}
            className="h-12 bg-[#EF4444] hover:bg-[#DC2626] active:scale-95 text-white font-bold text-sm rounded-xl shadow-md transition-all select-none touch-manipulation cursor-pointer flex items-center justify-center gap-2"
          >
            <Trash2 size={16} />
            <span>Delete Label</span>
          </button>
        </div>
      </div>
    </div>
  );
}
