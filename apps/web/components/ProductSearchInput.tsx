'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useLabelStore } from '../store/labelStore';
import { searchProducts, getProductByBarcode } from '../app/actions/products';
import { HARDCODED_PRODUCTS, ProductItem } from '../constants/products';
import { Search, X, ScanBarcode } from 'lucide-react';

function filterProducts(query: string, list: ProductItem[]): ProductItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;

  const prefixMatches: ProductItem[] = [];
  const substringMatches: ProductItem[] = [];
  const fuzzyMatches: ProductItem[] = [];

  for (const item of list) {
    const name = item.name.toLowerCase();
    if (name.startsWith(q)) {
      prefixMatches.push(item);
    } else if (name.includes(q)) {
      substringMatches.push(item);
    } else {
      let qIdx = 0;
      for (let i = 0; i < name.length && qIdx < q.length; i++) {
        if (name[i] === q[qIdx]) {
          qIdx++;
        }
      }
      if (qIdx === q.length) {
        fuzzyMatches.push(item);
      }
    }
  }

  return [...prefixMatches, ...substringMatches, ...fuzzyMatches];
}

export function ProductSearchInput() {
  const { product, setProduct, setExpiryDate } = useLabelStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>(HARDCODED_PRODUCTS);
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

  const handleBarcodeLookup = async (barcode: string) => {
    setIsOpen(false);
    const res = await getProductByBarcode(barcode);
    if (res.notFound) {
      setErrorMsg(`Barcode not found: ${barcode}`);
      setTimeout(() => setErrorMsg(''), 3000);
      setSearchTerm('');
    } else if (res.data) {
      setProduct({ id: res.data.id, name: res.data.name });
      if (res.data.expiry_date) {
        setExpiryDate(res.data.expiry_date);
      }
      setSearchTerm(res.data.name);
    }
  };

  const handleSelectProduct = async (item: any) => {
    setIsOpen(false);
    setSelectedIndex(-1);
    setProduct({ id: item.id, name: item.name });
    if (item.expiry_date) {
      setExpiryDate(item.expiry_date);
    }
    setSearchTerm(item.name);
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

    if (val.trim()) {
      const exactMatch = HARDCODED_PRODUCTS.find(
        (p) => p.name.toLowerCase() === val.trim().toLowerCase()
      );
      if (exactMatch) {
        setProduct({ id: exactMatch.id, name: exactMatch.name });
        if (exactMatch.expiry_date) setExpiryDate(exactMatch.expiry_date);
      } else {
        setProduct({ id: 'manual', name: val.trim() });
      }
    } else {
      setProduct(null);
    }

    const localFiltered = filterProducts(val, HARDCODED_PRODUCTS);
    setResults(localFiltered);
    setIsOpen(true);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (val.trim().length > 1) {
      debounceTimerRef.current = setTimeout(async () => {
        const res = await searchProducts(val);
        if (res.data && Array.isArray(res.data)) {
          const merged = [...localFiltered];
          for (const item of res.data) {
            if (!merged.some((p) => p.name.toLowerCase() === item.name.toLowerCase())) {
              merged.push(item);
            }
          }
          setResults(merged);
        }
      }, 250);
    }
  };

  const handleFocus = () => {
    const filtered = filterProducts(searchTerm, HARDCODED_PRODUCTS);
    setResults(filtered);
    setIsOpen(true);
  };

  const handleClear = () => {
    setSearchTerm('');
    if (product) setProduct(null);
    setResults(HARDCODED_PRODUCTS);
    setIsOpen(true);
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
      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white border border-[#DCE7F5] rounded-2xl z-50 max-h-[380px] overflow-y-auto shadow-xl py-1">
          {results.length > 0 ? (
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
