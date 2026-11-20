'use client';

import React, { createContext, useContext } from 'react';

import { DEFAULT_LABEL_PAPER, type LabelPaper } from '../lib/labelPaper';

const PaperContext = createContext(DEFAULT_LABEL_PAPER);
export const useLabelPaper = () => useContext(PaperContext);

export function LabelPaperProvider({ paper, children }: { paper: LabelPaper; children: React.ReactNode }) {
  return <PaperContext.Provider value={paper}>{children}</PaperContext.Provider>;
}
