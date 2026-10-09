'use client';
import React, { useEffect } from 'react';
import { useLabelStore } from '../store/labelStore';

export function ProductInfoPopup() {
  const { productInfoData, closeProductInfoPopup, setProduct, setExpiryDate } = useLabelStore();

  const handleConfirm = () => {
    if (productInfoData) {
      setProduct({ id: productInfoData.id, name: productInfoData.name });
      if (productInfoData.expiry_date) {
        setExpiryDate(productInfoData.expiry_date);
      }
    }
    closeProductInfoPopup();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [productInfoData]);

  if (!productInfoData) return null;

  return (
    <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden w-[600px] max-w-full flex flex-col">
        {/* Header */}
        <div className="bg-[#1F48FF] text-white p-6 text-center">
          <h2 className="text-3xl font-extrabold uppercase">Product Information</h2>
        </div>
        
        {/* Body */}
        <div className="p-8 flex flex-col gap-6 bg-gray-50">
          <div className="bg-white border-2 border-gray-200 p-6 rounded-2xl flex flex-col gap-2">
            <span className="text-gray-500 font-bold uppercase tracking-wider text-sm">Product Name</span>
            <span className="text-3xl lg:text-4xl font-extrabold text-blue-900 leading-tight">
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
        <div className="p-6 bg-white border-t-2 border-gray-100 flex justify-end gap-4">
          <button 
            onClick={closeProductInfoPopup}
            className="px-8 py-4 rounded-xl font-bold text-xl text-gray-500 bg-gray-100 active:bg-gray-200"
          >
            CANCEL
          </button>
          <button 
            onClick={handleConfirm}
            className="px-8 py-4 rounded-xl font-extrabold text-xl text-white bg-green-500 active:bg-green-600 shadow-md"
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
    <div className={`border-2 rounded-xl p-4 flex flex-col gap-1 ${highlight ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
      <span className={`text-sm font-bold uppercase ${highlight ? 'text-red-500' : 'text-gray-400'}`}>{label}</span>
      <span className={`text-2xl font-extrabold ${highlight ? 'text-red-700' : 'text-gray-800'}`}>{value}</span>
    </div>
  );
}
