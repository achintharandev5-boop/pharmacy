'use client';

import React from 'react';
import Link from 'next/link';
import { useLabelStore } from '../../store/labelStore';
import { CustomerSearchInput } from '../CustomerSearchInput';
import { ProductSearchInput } from '../ProductSearchInput';
import { Home, Package, Minus, Plus, MoreHorizontal } from 'lucide-react';

export function ProductToolbar() {
  const setCustomerSearchVisible = useLabelStore((state) => state.setCustomerSearchVisible);
  const alternativeProductName = useLabelStore((state) => state.alternativeProductName);
  const setAlternativeProductName = useLabelStore((state) => state.setAlternativeProductName);
  const productQuantity = useLabelStore((state) => state.productQuantity);
  const setProductQuantity = useLabelStore((state) => state.setProductQuantity);
  const openNumberPad = useLabelStore((state) => state.openNumberPad);

  const qty = productQuantity ?? 1;

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = Math.max(1, qty - 1);
    setProductQuantity(next);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    setProductQuantity(qty + 1);
  };

  return (
    <header className="w-full shrink-0 select-none relative z-30" style={{ height: '84px' }}>
      <div
        className="w-full h-full grid items-stretch gap-2.5"
        style={{
          gridTemplateColumns: 'minmax(0, 2.5fr) minmax(48px, 0.5fr) minmax(0, 2.9fr) minmax(0, 1.8fr) minmax(0, 1.4fr) minmax(0, 0.9fr)',
        }}
      >
        {/* 1. CUSTOMER SEARCH (~25%) */}
        <div className="h-full">
          <CustomerSearchInput />
        </div>

        {/* 2. CUSTOMER LOOKUP (...) (~5%) */}
        <div className="h-full">
          <button
            type="button"
            onClick={() => setCustomerSearchVisible(true)}
            aria-label="Open customer search panel"
            className="w-full h-full bg-white border border-[#DCE7F5] rounded-2xl flex items-center justify-center text-[#2563EB] shadow-[0_2px_8px_rgba(15,23,42,0.03)] hover:bg-[#F0F6FF] hover:border-[#BFDBFE] active:scale-95 transition-all select-none touch-manipulation cursor-pointer"
          >
            <MoreHorizontal size={22} className="text-[#2563EB]" />
          </button>
        </div>

        {/* 3. PRODUCT SEARCH (~29%) */}
        <div className="h-full">
          <ProductSearchInput />
        </div>

        {/* 4. ALTERNATIVE PRODUCT (~18%) */}
        <div className="h-full">
          <div className="w-full h-full bg-white border border-[#DCE7F5] rounded-2xl px-3.5 py-2 flex flex-col justify-center shadow-[0_2px_8px_rgba(15,23,42,0.03)] hover:border-[#BFDBFE] transition-colors">
            <label className="text-xs font-bold text-[#0F172A] leading-tight block">
              Alternative Product
            </label>
            <input
              type="text"
              value={alternativeProductName}
              onChange={(e) => setAlternativeProductName(e.target.value)}
              placeholder="e.g. Different brand..."
              aria-label="Alternative product name"
              className="w-full bg-transparent text-xs text-[#475569] font-medium outline-none placeholder:text-[#94A3B8] leading-tight mt-1"
            />
          </div>
        </div>

        {/* 5. PRODUCT QTY CARD (~14%) */}
        <div className="h-full">
          <div className="w-full h-full bg-white border border-[#DCE7F5] rounded-2xl px-3.5 py-1.5 flex flex-col justify-between shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            {/* Top row: Green icon + label */}
            <div className="flex items-center gap-1.5 text-[#059669]">
              <Package size={14} className="text-[#059669]" />
              <span className="text-xs font-bold text-[#059669]">Product Qty</span>
            </div>

            {/* Bottom row: [-] [1] [+] */}
            <div className="flex items-center justify-between gap-1.5 mt-0.5">
              <button
                type="button"
                onClick={handleDecrement}
                aria-label="Decrease product quantity"
                className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] active:scale-95 flex items-center justify-center font-bold text-base transition-all select-none touch-manipulation cursor-pointer"
              >
                <Minus size={15} strokeWidth={2.5} />
              </button>

              <button
                type="button"
                onClick={() => openNumberPad('product_quantity')}
                aria-label={`Product quantity: ${qty}`}
                className="flex-1 text-center font-bold text-base text-[#0F172A] hover:text-[#2563EB] cursor-pointer"
              >
                {qty}
              </button>

              <button
                type="button"
                onClick={handleIncrement}
                aria-label="Increase product quantity"
                className="w-8 h-8 rounded-lg bg-[#2563EB] text-white hover:bg-[#1D4ED8] active:scale-95 flex items-center justify-center font-bold text-base transition-all select-none touch-manipulation cursor-pointer shadow-sm"
              >
                <Plus size={15} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>

        {/* 6. HOME (~9%) */}
        <div className="h-full">
          <Link
            href="/"
            aria-label="Go to home"
            className="w-full h-full bg-[#EFF6FF] border border-[#BFDBFE] rounded-2xl flex flex-col items-center justify-center text-[#2563EB] hover:bg-[#DBEAFE] active:scale-95 transition-all shadow-[0_2px_8px_rgba(15,23,42,0.03)] cursor-pointer select-none touch-manipulation"
          >
            <Home size={24} className="text-[#2563EB]" />
            <span className="text-xs font-bold mt-1 text-[#2563EB]">Home</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
