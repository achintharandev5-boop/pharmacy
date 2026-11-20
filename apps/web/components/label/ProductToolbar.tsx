'use client';

import React from 'react';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import Link from 'next/link';
import { useLabelStore } from '../../store/labelStore';
import { CustomerSearchInput } from '../CustomerSearchInput';
import { ProductSearchInput } from '../ProductSearchInput';
import { Home, Minus, Plus } from 'lucide-react';
import { TOOLBAR_FIELD, TOOLBAR_FOCUS_RING, TOOLBAR_INPUT, TOOLBAR_LABEL } from './toolbarStyles';
import { PLUS_TONE } from './buttonVariants';

const STEP_BUTTON = `w-11 h-11 shrink-0 rounded-ui flex items-center justify-center transition-colors select-none touch-manipulation cursor-pointer ${TOOLBAR_FOCUS_RING}`;

export function ProductToolbar() {
  const alternativeProductName = useLabelStore((state) => state.alternativeProductName);
  const setAlternativeProductName = useLabelStore((state) => state.setAlternativeProductName);
  const productQuantity = useLabelStore((state) => state.productQuantity);
  const setProductQuantity = useLabelStore((state) => state.setProductQuantity);
  const openNumberPad = useLabelStore((state) => state.openNumberPad);

  const qty = productQuantity;

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (qty == null) return;
    const next = Math.max(1, qty - 1);
    setProductQuantity(next);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    setProductQuantity((qty ?? 0) + 1);
  };

  return (
    // Desktop (≥1024 px): one compact 70 px toolbar row. Tablet: Patient + Medicine, then Alternative + Qty/Home/Theme.
    // Phone: Patient, Medicine, Alternative stacked, then Qty + Home + Theme on one row.
    <header className="w-full shrink-0 select-none relative z-30">
      <div className="w-full bg-page border border-border rounded-ui-lg shadow-card p-2 grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,3.2fr)_minmax(0,1.6fr)_auto] lg:h-[70px]">
        <div className="min-w-0">
          <CustomerSearchInput />
        </div>

        <div className="min-w-0">
          <ProductSearchInput />
        </div>

        <div className="min-w-0">
          <div
            onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}
            className={TOOLBAR_FIELD}
          >
            <span className="flex-1 min-w-0 flex flex-col justify-center">
              <label htmlFor="alternative-product" className={TOOLBAR_LABEL}>
                Alternative <span className="normal-case tracking-normal font-medium text-subtle">· optional</span>
              </label>
              <input
                id="alternative-product"
                type="text"
                value={alternativeProductName}
                onChange={(e) => setAlternativeProductName(e.target.value)}
                placeholder="Other brand"
                aria-label="Alternative product name"
                className={TOOLBAR_INPUT}
              />
            </span>
          </div>
        </div>

        <div className="min-w-0 flex items-stretch gap-2">
          {/* Product quantity: required before DONE (the DONE check names the label if it is missing). */}
          <div
            role="group"
            aria-label="Product quantity"
            className={`flex-1 lg:flex-none min-h-[60px] lg:min-h-0 border rounded-ui-lg pl-3 pr-1.5 flex items-center gap-3 transition-colors ${
              qty == null ? 'bg-warning-soft border-warning-border' : 'bg-surface border-border'
            }`}
          >
            <span className="flex flex-col justify-center mr-auto lg:mr-0 min-w-11">
              <span className={TOOLBAR_LABEL}>Qty</span>
              {qty == null
                ? <span className="text-[11px] font-semibold text-warning leading-none mt-1.5">Required</span>
                : <span className="text-[11px] font-medium text-subtle leading-none mt-1.5">Units</span>}
            </span>

            {/* One segmented stepper: − value +. Minus and plus sit on either side of the value, so a
                tap meant for one never lands on the other. */}
            <div className="flex items-stretch h-11 rounded-ui border border-border-strong bg-page overflow-hidden">
              <button
                type="button"
                onClick={handleDecrement}
                disabled={qty == null || qty <= 1}
                aria-label="Decrease product quantity"
                className={`${STEP_BUTTON} h-full rounded-none text-graphite hover:bg-surface active:bg-surface-2 disabled:text-disabled disabled:hover:bg-transparent disabled:cursor-not-allowed`}
              >
                <Minus size={18} strokeWidth={2.5} aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => openNumberPad('product_quantity')}
                aria-label={qty == null ? 'Product quantity not set. Enter quantity' : `Product quantity: ${qty}`}
                className={`w-14 shrink-0 border-x border-border text-center tabular hover:bg-primary-soft hover:text-primary cursor-pointer transition-colors ${TOOLBAR_FOCUS_RING} ${
                  qty == null ? 'text-sm font-semibold text-warning' : 'text-xl font-bold text-fg'
                }`}
              >
                {qty ?? 'Set'}
              </button>

              <button
                type="button"
                onClick={handleIncrement}
                aria-label="Increase product quantity"
                className={`${STEP_BUTTON} h-full rounded-none ${PLUS_TONE}`}
              >
                <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Home and theme share one compact utility group. */}
          <div className="min-h-[60px] lg:min-h-0 shrink-0 flex items-center gap-0.5 px-1 bg-surface border border-border rounded-ui-lg">
            <Link
              href="/"
              aria-label="Go to home"
              title="Home"
              className={`h-11 min-w-11 px-2.5 rounded-ui flex items-center justify-center gap-1.5 text-sm font-semibold text-muted hover:text-primary hover:bg-primary-soft transition-colors cursor-pointer select-none touch-manipulation ${TOOLBAR_FOCUS_RING}`}
            >
              <Home size={18} aria-hidden="true" />
              <span className="sm:hidden">Home</span>
            </Link>
            <span className="w-px h-6 bg-border" aria-hidden="true" />
            <ThemeSwitcher iconOnly />
          </div>
        </div>
      </div>
    </header>
  );
}
