'use client';

import React from 'react';
import { useLabelStore } from '../../store/labelStore';

interface PreviewStripProps {
  validationError?: string | null;
}

export function PreviewStrip({ validationError }: PreviewStripProps) {
  const numberPad = useLabelStore((state) => state.numberPad);

  return (
    <div className={`h-16 shrink-0 border-2 rounded-ui-lg flex items-center px-5 text-xl font-black transition-all ${
      validationError
        ? 'bg-danger text-white border-danger shadow-pop animate-pulse'
        : 'bg-primary-soft text-primary border-primary shadow-card'
    }`}>
      {validationError
        ? `⚠️ ${validationError}`
        : numberPad.visible ? `SELECTED QTY: ${numberPad.buffer}` : 'SELECTED BUTTON PREVIEW PANEL WITH QTY'
      }
    </div>
  );
}
