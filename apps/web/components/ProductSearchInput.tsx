'use client';
import { uiTestEnabled } from '@/lib/uiTestMode';
import React, { useState, useRef, useEffect } from 'react';
import { useLabelStore } from '../store/labelStore';
import { searchProducts, getProductByBarcode } from '../app/actions/products';
import type { SelectedProduct } from '../store/labelStore';
import type { ProductSearchResult } from '../app/actions/products';
import { NETWORK_ERROR_MESSAGE } from '../lib/api/types';
import { PRODUCT_TYPES, resolveProductType, toSelectedProduct } from '../lib/productType';
import { Search, X, ScanBarcode, Loader2 } from 'lucide-react';
import { TOOLBAR_FIELD_PROMINENT, TOOLBAR_ICON_BUTTON, TOOLBAR_ICON_BUTTON_ACCENT, TOOLBAR_INPUT_PROMINENT, TOOLBAR_LABEL } from './label/toolbarStyles';

type SearchStatus = 'idle' | 'loading' | 'error' | 'done';

export function ProductSearchInput() {
  const { product, setProduct } = useLabelStore();
  const searchTerm = product?.name ?? '';
  const productType = product ? resolveProductType(product.product_type) : null;
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const barcodeBufferRef = useRef<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sets the label's product. The store removes any batch expiry of the previous medicine; an
  // expiry is printed only after Add Expiry Date retrieves the GRN batch date (never auto-selected).
  const applyProduct = (next: SelectedProduct | null) => setProduct(next);

  const handleBarcodeLookup = async (barcode: string) => {
    setIsOpen(false);
    if (uiTestEnabled()) return;
    let res: Awaited<ReturnType<typeof getProductByBarcode>>;
    try {
      res = await getProductByBarcode(barcode);
    } catch {
      res = { ok: false, error: NETWORK_ERROR_MESSAGE };
    }
    if (res.ok) {
      applyProduct(toSelectedProduct(res.data));
      return;
    }
    const notFound = res.status === 404;
    setErrorMsg(notFound ? `Barcode not found: ${barcode}` : `Barcode lookup failed: ${res.error}`);
    setTimeout(() => setErrorMsg(''), notFound ? 3000 : 6000);
    if (notFound) applyProduct(null);
  };

  const handleSelectProduct = (item: ProductSearchResult) => {
    setIsOpen(false);
    setSelectedIndex(-1);
    applyProduct(toSelectedProduct(item));
  };

  const runSearch = async (term: string) => {
    const requestId = ++requestIdRef.current;
    setSearchStatus('loading');
    setSearchError(null);
    let res: Awaited<ReturnType<typeof searchProducts>>;
    try {
      res = await searchProducts(term);
    } catch {
      res = { ok: false, error: NETWORK_ERROR_MESSAGE };
    }
    if (requestId !== requestIdRef.current) return; // superseded by a newer search
    if (res.ok) {
      setResults(res.data);
      setSearchStatus('done');
    } else {
      setResults([]);
      setSearchError(res.error);
      setSearchStatus('error');
    }
  };

  const resetSearch = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    requestIdRef.current++;
    setResults([]);
    setSearchStatus('idle');
    setSearchError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now();
    if (now - lastKeyTimeRef.current > 50) {
      barcodeBufferRef.current = '';
    }
    lastKeyTimeRef.current = now;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) return;
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      return;
    }

    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (barcodeBufferRef.current.length >= 3) {
        const barcode = barcodeBufferRef.current;
        barcodeBufferRef.current = '';
        handleBarcodeLookup(barcode);
        return;
      }

      if (isOpen && selectedIndex >= 0 && results[selectedIndex]) {
        handleSelectProduct(results[selectedIndex]);
        return;
      }

      if (isOpen && results.length > 0) {
        handleSelectProduct(results[0]);
        return;
      }
    } else if (e.key.length === 1) {
      barcodeBufferRef.current += e.key;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSelectedIndex(-1);

    // Typed text is used as a manual product name until a catalog result is chosen.
    applyProduct(val.trim() ? { id: 'manual', name: val.trim() } : null);
    setIsOpen(!uiTestEnabled());
    if (uiTestEnabled()) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (val.trim().length > 1) {
      debounceTimerRef.current = setTimeout(() => runSearch(val), 250);
    } else {
      resetSearch();
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleClear = () => {
    if (product) applyProduct(null);
    resetSearch();
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="w-full h-full relative flex items-center">
      {/* Product Search Card Container */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={TOOLBAR_FIELD_PROMINENT}
      >
        <span className="shrink-0 text-primary" aria-hidden="true">
          {searchStatus === 'loading'
            ? <Loader2 size={18} className="animate-spin" />
            : <Search size={18} />}
        </span>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <span className={`${TOOLBAR_LABEL} flex items-center gap-1.5`}>
            Medicine
            {/* UI testing: the typed name is a manual test product, never catalogue data. */}
            {uiTestEnabled() && (
              <span
                title="UI testing: manual test product, not catalogue data"
                className="px-1.5 py-0.5 rounded-ui-sm bg-warning-soft border border-warning-border text-warning text-[10px] font-bold uppercase tracking-wide leading-none"
              >
                Test<span className="sr-only">: manual test product, not catalogue data</span>
              </span>
            )}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={handleChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            aria-label={uiTestEnabled() ? "Manual test-product name" : "Medicine search"}
            placeholder={uiTestEnabled() ? "Type a test medicine" : "Name, barcode or brand"}
            className={TOOLBAR_INPUT_PROMINENT}
          />
          {/* Product type and (UI testing only) the test-type picker share one line to keep the
              toolbar compact. */}
          <div className={`flex items-center gap-2 min-w-0 ${productType || (uiTestEnabled() && product?.id === 'manual') ? 'mt-0.5' : ''}`}>
            <div
              role={productType?.message ? 'alert' : 'status'}
              aria-label="Selected product type"
              title={productType?.message ?? undefined}
              className={`text-[11px] font-semibold leading-tight truncate min-w-0 ${productType?.message ? 'text-warning' : 'text-subtle'}`}
            >
              {productType
                ? productType.message ?? <><span className="sr-only">Product type: </span>{`${productType.type} · ${productType.sinhala}`}</>
                : <span className="sr-only">No medicine selected</span>}
            </div>
            {/* UI testing only: a typed test product has no catalogue record, so the tester states its
                type. Marked as a test value; the product-type rules are applied unchanged. */}
            {uiTestEnabled() && product?.id === 'manual' && (
              <label
                className="text-[11px] text-warning font-semibold leading-tight flex items-center gap-1 whitespace-nowrap shrink-0"
                title="Temporary test product type for UI testing only. Not catalogue data."
                onClick={(e) => e.stopPropagation()}
              >
                Type:
                <select
                  aria-label="Temporary test product type (UI testing only)"
                  value={product.product_type ?? ''}
                  onChange={(e) => setProduct({ ...product, product_type: e.target.value || null })}
                  className="bg-page border border-warning-border rounded-ui-sm px-1 text-fg"
                >
                  <option value="">Not set</option>
                  {Object.keys(PRODUCT_TYPES).map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
            )}
          </div>
        </div>

        {/* Clear Button */}
        {searchTerm && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className={TOOLBAR_ICON_BUTTON}
            aria-label="Clear medicine search"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}

        {/* Barcode Scanner Icon */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.focus();
          }}
          className={TOOLBAR_ICON_BUTTON_ACCENT}
          title="Barcode scanner ready"
          aria-label="Focus medicine search for the barcode scanner"
        >
          <ScanBarcode size={18} aria-hidden="true" />
        </button>
      </div>
      
      {/* Error message */}
      {errorMsg && (
        <div className="absolute top-[calc(100%+6px)] left-0 mt-1 bg-danger-soft text-danger font-bold text-xs px-3 py-1.5 z-50 border border-danger-border rounded-ui-lg shadow-md">
          {errorMsg}
        </div>
      )}

      {/* DROPDOWN MENU */}
      {isOpen && searchStatus !== 'idle' && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-page border border-border rounded-ui-lg z-50 max-h-[380px] overflow-y-auto shadow-pop py-1">
          {searchStatus === 'loading' ? (
            <div role="status" className="p-4 text-center bg-surface">
              <p className="text-xs font-semibold text-subtle">Searching products…</p>
            </div>
          ) : searchStatus === 'error' ? (
            <div role="alert" className="p-4 text-center bg-danger-soft space-y-2">
              <p className="text-xs font-semibold text-danger">Product search failed: {searchError}</p>
              <button
                type="button"
                onClick={() => runSearch(searchTerm)}
                className="px-3 py-1.5 text-xs font-bold bg-page border border-danger-border text-danger rounded-lg hover:bg-danger-soft touch-manipulation"
              >
                Retry
              </button>
            </div>
          ) : results.length > 0 ? (
            results.map((r, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={r.id || index}
                  type="button"
                  onClick={() => handleSelectProduct(r)}
                  className={`w-full text-left px-4 py-3 border-b border-surface last:border-b-0 transition-colors touch-manipulation flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-primary-soft border-l-4 border-l-primary'
                      : 'hover:bg-surface active:bg-surface-2'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-fg leading-tight">
                      {r.name}
                    </span>
                    {r.product_type && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-primary-soft text-primary rounded-md border border-primary-border">
                        {r.product_type}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-subtle font-medium">
                    {r.stock_quantity !== undefined && (
                      <span>Stock: <strong className="text-fg font-bold">{r.stock_quantity}</strong></span>
                    )}
                    {r.expiry_date && (
                      <span>Exp: <strong className="text-danger font-bold">{r.expiry_date}</strong></span>
                    )}
                    {r.pack_size && (
                      <span>Pack: <strong className="text-fg font-bold">{r.pack_size}</strong></span>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-4 text-center bg-surface">
              <p className="text-xs font-semibold text-muted">
                No products found matching <span className="text-danger font-bold">&quot;{searchTerm}&quot;</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
