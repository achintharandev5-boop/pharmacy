'use client';

import React, { useState, useEffect } from 'react';
import { useLabelStore } from '../../store/labelStore';
import { Calendar, X, Check, Trash2 } from 'lucide-react';

export function ExpDateModal() {
  const expDateModalVisible = useLabelStore((state) => state.expDateModalVisible);
  const closeExpDateModal = useLabelStore((state) => state.closeExpDateModal);
  const expiryDate = useLabelStore((state) => state.expiryDate);
  const setExpiryDate = useLabelStore((state) => state.setExpiryDate);
  const productExpiry = useLabelStore((state) => state.product?.expiry_date ?? null);

  const [dateInput, setDateInput] = useState('');

  useEffect(() => {
    // Pre-fill from the label, then from the product's recorded expiry. Never a guessed date.
    setDateInput(expiryDate || productExpiry || '');
  }, [expiryDate, productExpiry, expDateModalVisible]);

  if (!expDateModalVisible) return null;

  const handleSave = () => {
    setExpiryDate(dateInput.trim() || null);
    closeExpDateModal();
  };

  const handleClear = () => {
    setDateInput('');
    setExpiryDate(null);
    closeExpDateModal();
  };

  return (
    <div className="fixed inset-0 z-50 bg-fg/40 flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white rounded-ui-lg border border-border shadow-pop overflow-hidden w-[500px] max-w-full flex flex-col p-6 relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={closeExpDateModal}
          className="absolute top-4 right-4 w-8 h-8 rounded-full text-subtle hover:text-fg hover:bg-surface-2 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-ui-lg bg-primary-soft border border-primary-border text-primary flex items-center justify-center shadow-sm shrink-0">
            <Calendar size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-fg leading-tight">
              Expiry Date (EXP)
            </h2>
            <p className="text-xs text-subtle font-medium leading-tight mt-0.5">
              Enter custom date or choose a quick preset
            </p>
          </div>
        </div>

        {/* Input */}
        <div className="mb-4">
          <label className="text-xs font-bold text-muted block mb-1.5 uppercase tracking-wide">
            Expiry Date
          </label>
          <input
            type="text"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            placeholder="e.g. 1/8/2028 or 12/2026"
            className="w-full h-13 bg-surface border border-border rounded-ui-lg px-4 text-lg font-bold text-fg outline-none focus:border-2 focus:border-primary transition-colors"
          />
        </div>

        {/* Quick Presets */}
        <div className="mb-6">
          <label className="text-[11px] font-bold text-subtle block mb-1.5 uppercase tracking-wide">
            Quick Presets
          </label>
          <div className="grid grid-cols-3 gap-2">
            {['1 Month', '3 Months', '6 Months', '1 Year', '2 Years'].map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  const now = new Date();
                  if (label === '1 Month') now.setMonth(now.getMonth() + 1);
                  else if (label === '3 Months') now.setMonth(now.getMonth() + 3);
                  else if (label === '6 Months') now.setMonth(now.getMonth() + 6);
                  else if (label === '1 Year') now.setFullYear(now.getFullYear() + 1);
                  else if (label === '2 Years') now.setFullYear(now.getFullYear() + 2);

                  const formatted = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
                  setDateInput(formatted);
                }}
                className="h-10 bg-white border border-border hover:bg-primary-soft hover:border-primary-border active:scale-95 font-bold text-xs text-muted hover:text-primary rounded-ui-lg transition-all touch-manipulation cursor-pointer flex items-center justify-center"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions Footer */}
        <div className="grid grid-cols-3 gap-2.5 pt-4 border-t border-border">
          <button
            type="button"
            onClick={handleClear}
            className="h-12 bg-danger-soft hover:bg-[#FFE4E6] text-danger font-bold text-sm rounded-ui-lg transition-all select-none touch-manipulation cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Trash2 size={16} />
            <span>Clear</span>
          </button>
          <button
            type="button"
            onClick={closeExpDateModal}
            className="h-12 bg-surface-2 hover:bg-border text-muted font-bold text-sm rounded-ui-lg transition-all select-none touch-manipulation cursor-pointer flex items-center justify-center active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="h-12 bg-success hover:bg-success text-white font-bold text-sm rounded-ui-lg shadow-md transition-all select-none touch-manipulation cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Check size={18} strokeWidth={2.5} />
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
}
