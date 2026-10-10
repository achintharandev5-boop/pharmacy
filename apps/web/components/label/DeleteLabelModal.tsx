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
    <div className="fixed inset-0 z-50 bg-fg/40 flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white rounded-ui-lg border border-border shadow-pop overflow-hidden w-[460px] max-w-full flex flex-col p-6 relative">
        {/* Close icon button */}
        <button
          type="button"
          onClick={closeDeleteLabelModal}
          className="absolute top-4 right-4 w-8 h-8 rounded-full text-subtle hover:text-fg hover:bg-surface-2 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Danger Icon Badge */}
        <div className="w-14 h-14 rounded-ui-lg bg-danger-soft border border-danger-border text-danger flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Trash2 size={26} strokeWidth={2.5} />
        </div>

        {/* Title & Body */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-fg leading-tight">
            Delete Label {activeLabelIndex + 1} of {totalLabels}?
          </h2>
          <p className="text-sm font-medium text-subtle mt-2 leading-relaxed px-2">
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
            className="h-12 bg-surface-2 hover:bg-border active:scale-95 text-muted font-bold text-sm rounded-ui-lg transition-all select-none touch-manipulation cursor-pointer flex items-center justify-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmDeleteActiveLabel}
            className="h-12 bg-danger hover:bg-danger active:scale-95 text-white font-bold text-sm rounded-ui-lg shadow-md transition-all select-none touch-manipulation cursor-pointer flex items-center justify-center gap-2"
          >
            <Trash2 size={16} />
            <span>Delete Label</span>
          </button>
        </div>
      </div>
    </div>
  );
}
