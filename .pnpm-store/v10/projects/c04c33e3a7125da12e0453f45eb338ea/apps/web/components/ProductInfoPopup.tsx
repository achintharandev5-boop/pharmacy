'use client';
import React, { useCallback, useEffect } from 'react';
import { useModalFocus } from '@/lib/useModalFocus';
import { useLabelStore } from '../store/labelStore';

export function ProductInfoPopup() {
  const { productInfoData, closeProductInfoPopup, setProduct } = useLabelStore();

  const modalRef = useModalFocus(Boolean(productInfoData), closeProductInfoPopup);
  const handleConfirm = useCallback(() => {
    if (productInfoData) {
      // The expiry is not taken from the medicine record: Add Expiry Date reads the GRN batch.
      setProduct({ id: productInfoData.id, name: productInfoData.name });
    }
    closeProductInfoPopup();
  }, [productInfoData, setProduct, closeProductInfoPopup]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleConfirm]);

  if (!productInfoData) return null;

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Product information" className="absolute inset-0 z-50 bg-[var(--color-backdrop)] flex items-center justify-center p-4">
      <div className="bg-page rounded-ui-lg shadow-pop overflow-hidden w-[600px] max-w-full flex flex-col">
        {/* Header */}
        <div className="bg-primary text-[var(--color-on-solid)] p-6 text-center">
          <h2 className="text-3xl font-extrabold uppercase">Product Information</h2>
        </div>
        
        {/* Body */}
        <div className="p-8 flex flex-col gap-6 bg-surface">
          <div className="bg-page border-2 border-border p-6 rounded-ui-lg flex flex-col gap-2">
            <span className="text-subtle font-bold uppercase tracking-wider text-sm">Product Name</span>
            <span className="text-3xl lg:text-4xl font-extrabold text-primary leading-tight">
              {productInfoData.name}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InfoBox label="Stock Qty" value={productInfoData.stock_quantity ?? 'N/A'} />
            <InfoBox label="Pack Size" value={productInfoData.pack_size ?? 'N/A'} />
            <InfoBox label="Product Type" value={productInfoData.product_type ?? 'N/A'} />
            <InfoBox label="Expiry Date" value={productInfoData.expiry_date ?? 'N/A'} highlight={true} />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-page border-t-2 border-border flex justify-end gap-4">
          <button 
            onClick={closeProductInfoPopup}
            className="px-8 py-4 rounded-ui-lg font-bold text-xl text-subtle bg-surface-2 active:bg-border"
          >
            CANCEL
          </button>
          <button 
            onClick={handleConfirm}
            className="px-8 py-4 rounded-ui-lg font-extrabold text-xl text-[var(--color-on-solid)] bg-success active:bg-success shadow-md"
          >
            CONFIRM (ENTER)
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value, highlight = false }: { label: string, value: string | number, highlight?: boolean }) {
  return (
    <div className={`border-2 rounded-ui-lg p-4 flex flex-col gap-1 ${highlight ? 'bg-danger-soft border-danger-border' : 'bg-page border-border'}`}>
      <span className={`text-sm font-bold uppercase ${highlight ? 'text-danger' : 'text-subtle'}`}>{label}</span>
      <span className={`text-2xl font-extrabold ${highlight ? 'text-danger' : 'text-fg'}`}>{value}</span>
    </div>
  );
}
