'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useLabelStore } from '../store/labelStore';
import { searchProducts, getProductByBarcode } from '../app/actions/products';
import type { SelectedProduct } from '../store/labelStore';
import type { ProductSearchResult } from '../app/actions/products';
import { NETWORK_ERROR_MESSAGE } from '../lib/api/types';
import { Search, X, ScanBarcode } from 'lucide-react';

type SearchStatus = 'idle' | 'loading' | 'error' | 'done';

export function ProductSearchInput() {
  const { product, setProduct, setExpiryDate } = useLabelStore();
  const [searchTerm, setSearchTerm] = useState('');
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

  // Sync displayed value with store if a product is selected
  useEffect(() => {
    if (product) {
      setSearchTerm(product.name);
    }
  }, [product]);

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

  // Sets the label's product. An expiry carried over from the previous catalog product is
  // cleared so it can never be printed against a different medicine; a manually entered
  // expiry is kept.
  const applyProduct = (next: SelectedProduct | null) => {
    const { product: prev, expiryDate } = useLabelStore.getState();
    setProduct(next);
    if (next?.expiry_date) {
      setExpiryDate(next.expiry_date);
    } else if (prev?.expiry_date && expiryDate === prev.expiry_date && prev.id !== next?.id) {
      setExpiryDate(null);
    }
  };

  const handleBarcodeLookup = async (barcode: string) => {
    setIsOpen(false);
    let res: Awaited<ReturnType<typeof getProductByBarcode>>;
    try {
      res = await getProductByBarcode(barcode);
    } catch {
      res = { ok: false, error: NETWORK_ERROR_MESSAGE };
    }
    if (res.ok) {
      applyProduct({ id: res.data.id, name: res.data.name, expiry_date: res.data.expiry_date ?? null });
      setSearchTerm(res.data.name);
      return;
    }
    const notFound = res.status === 404;
    setErrorMsg(notFound ? `Barcode not found: ${barcode}` : `Barcode lookup failed: ${res.error}`);
    setTimeout(() => setErrorMsg(''), notFound ? 3000 : 6000);
    if (notFound) setSearchTerm('');
  };

  const handleSelectProduct = (item: ProductSearchResult) => {
    setIsOpen(false);
    setSelectedIndex(-1);
    applyProduct({ id: item.id, name: item.name, expiry_date: item.expiry_date ?? null });
    setSearchTerm(item.name);
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
    setSearchTerm(val);
    setSelectedIndex(-1);

    // Typed text is used as a manual product name until a catalog result is chosen.
    applyProduct(val.trim() ? { id: 'manual', name: val.trim() } : null);
    setIsOpen(true);

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
    setSearchTerm('');
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
        className="w-full h-full bg-white border border-[#DCE7F5] rounded-2xl px-3.5 py-2 flex items-center gap-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.03)] hover:border-[#BFDBFE] transition-colors cursor-text"
      >
        {/* Blue Search Icon */}
        <Search size={22} className="text-[#2563EB] shrink-0" />

        {/* Text Input Stack */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={handleChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder="Search product, barcode or brand..."
            className="w-full bg-transparent text-sm font-bold text-[#0F172A] outline-none placeholder:text-[#94A3B8] placeholder:font-normal leading-tight"
          />
          <div className="text-[11px] text-[#94A3B8] font-normal leading-none mt-1 truncate">
            Search product, barcode or brand...
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
            className="w-6 h-6 flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] active:text-black select-none touch-manipulation rounded-full hover:bg-[#F1F5F9] shrink-0"
            title="Clear search"
          >
            <X size={15} />
          </button>
        )}

        {/* Vertical Divider */}
        <div className="h-6 w-px bg-[#E2ECF8] shrink-0" />

        {/* Barcode Scanner Icon */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.focus();
          }}
          className="text-[#2563EB] hover:text-[#1D4ED8] p-1 rounded-lg hover:bg-[#EFF6FF] shrink-0 transition-colors"
          title="Barcode Scanner Ready"
        >
          <ScanBarcode size={22} />
        </button>
      </div>
      
      {/* Error message */}
      {errorMsg && (
        <div className="absolute top-[calc(100%+6px)] left-0 mt-1 bg-[#FEF2F2] text-[#E11D48] font-bold text-xs px-3 py-1.5 z-50 border border-[#FECDD3] rounded-xl shadow-md">
          {errorMsg}
        </div>
      )}

      {/* DROPDOWN MENU */}
      {isOpen && searchStatus !== 'idle' && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white border border-[#DCE7F5] rounded-2xl z-50 max-h-[380px] overflow-y-auto shadow-xl py-1">
          {searchStatus === 'loading' ? (
            <div role="status" className="p-4 text-center bg-[#F8FAFC]">
              <p className="text-xs font-semibold text-slate-500">Searching products…</p>
            </div>
          ) : searchStatus === 'error' ? (
            <div role="alert" className="p-4 text-center bg-rose-50 space-y-2">
              <p className="text-xs font-semibold text-rose-800">Product search failed: {searchError}</p>
              <button
                type="button"
                onClick={() => runSearch(searchTerm)}
                className="px-3 py-1.5 text-xs font-bold bg-white border border-rose-300 text-rose-800 rounded-lg hover:bg-rose-100 touch-manipulation"
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
                  className={`w-full text-left px-4 py-3 border-b border-[#F8FAFC] last:border-b-0 transition-colors touch-manipulation flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-[#EFF6FF] border-l-4 border-l-[#2563EB]'
                      : 'hover:bg-[#F8FAFC] active:bg-[#F1F5F9]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-[#0F172A] leading-tight">
                      {r.name}
                    </span>
                    {r.product_type && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-[#EFF6FF] text-[#2563EB] rounded-md border border-[#BFDBFE]">
                        {r.product_type}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                    {r.stock_quantity !== undefined && (
                      <span>Stock: <strong className="text-slate-800 font-bold">{r.stock_quantity}</strong></span>
                    )}
                    {r.expiry_date && (
                      <span>Exp: <strong className="text-[#E11D48] font-bold">{r.expiry_date}</strong></span>
                    )}
                    {r.pack_size && (
                      <span>Pack: <strong className="text-slate-800 font-bold">{r.pack_size}</strong></span>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-4 text-center bg-[#F8FAFC]">
              <p className="text-xs font-semibold text-slate-600">
                No products found matching <span className="text-[#E11D48] font-bold">"{searchTerm}"</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
