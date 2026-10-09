'use client';

import React from 'react';
import { useLabelStore } from '../../store/labelStore';

interface PreviewStripProps {
  validationError?: string | null;
}

export function PreviewStrip({ validationError }: PreviewStripProps) {
  const numberPad = useLabelStore((state) => state.numberPad);

  return (
    <div className={`h-16 shrink-0 border-2 rounded-2xl flex items-center px-5 text-xl font-black transition-all ${
      validationError
        ? 'bg-rose-500 text-white border-rose-600 shadow-lg shadow-rose-500/25 animate-pulse'
        : 'bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-50 text-blue-700 border-blue-500/80 shadow-sm'
    }`}>
      {validationError
        ? `⚠️ ${validationError}`
        : numberPad.visible ? `SELECTED QTY: ${numberPad.buffer}` : 'SELECTED BUTTON PREVIEW PANEL WITH QTY'
      }
    </div>
  );
}
