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
            className="w-full h-full bg-white border border-border rounded-ui-lg flex items-center justify-center text-primary shadow-card hover:bg-primary-soft hover:border-primary-border active:scale-95 transition-all select-none touch-manipulation cursor-pointer"
          >
            <MoreHorizontal size={22} className="text-primary" />
          </button>
        </div>

        {/* 3. PRODUCT SEARCH (~29%) */}
        <div className="h-full">
          <ProductSearchInput />
        </div>

        {/* 4. ALTERNATIVE PRODUCT (~18%) */}
        <div className="h-full">
          <div className="w-full h-full bg-white border border-border rounded-ui-lg px-3.5 py-2 flex flex-col justify-center shadow-card hover:border-primary-border transition-colors">
            <label className="text-xs font-bold text-fg leading-tight block">
              Alternative Product
            </label>
            <input
              type="text"
              value={alternativeProductName}
              onChange={(e) => setAlternativeProductName(e.target.value)}
              placeholder="e.g. Different brand..."
              aria-label="Alternative product name"
              className="w-full bg-transparent text-xs text-muted font-medium outline-none placeholder:text-subtle leading-tight mt-1"
            />
          </div>
        </div>

        {/* 5. PRODUCT QTY CARD (~14%) */}
        <div className="h-full">
          <div className="w-full h-full bg-white border border-border rounded-ui-lg px-3.5 py-1.5 flex flex-col justify-between shadow-card">
            {/* Top row: Green icon + label */}
            <div className="flex items-center gap-1.5 text-success">
              <Package size={14} className="text-success" />
              <span className="text-xs font-bold text-success">Product Qty</span>
            </div>

            {/* Bottom row: [-] [1] [+] */}
            <div className="flex items-center justify-between gap-1.5 mt-0.5">
              <button
                type="button"
                onClick={handleDecrement}
                aria-label="Decrease product quantity"
                className="w-8 h-8 rounded-lg bg-primary-soft text-primary hover:bg-primary-border active:scale-95 flex items-center justify-center font-bold text-base transition-all select-none touch-manipulation cursor-pointer"
              >
                <Minus size={15} strokeWidth={2.5} />
              </button>

              <button
                type="button"
                onClick={() => openNumberPad('product_quantity')}
                aria-label={`Product quantity: ${qty}`}
                className="flex-1 text-center font-bold text-base text-fg hover:text-primary cursor-pointer"
              >
                {qty}
              </button>

              <button
                type="button"
                onClick={handleIncrement}
                aria-label="Increase product quantity"
                className="w-8 h-8 rounded-lg bg-primary text-white hover:bg-primary-hover active:scale-95 flex items-center justify-center font-bold text-base transition-all select-none touch-manipulation cursor-pointer shadow-sm"
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
            className="w-full h-full bg-primary-soft border border-primary-border rounded-ui-lg flex flex-col items-center justify-center text-primary hover:bg-primary-border active:scale-95 transition-all shadow-card cursor-pointer select-none touch-manipulation"
          >
            <Home size={24} className="text-primary" />
            <span className="text-xs font-bold mt-1 text-primary">Home</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
