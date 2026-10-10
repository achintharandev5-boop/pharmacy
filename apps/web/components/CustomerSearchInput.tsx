'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useLabelStore } from '../store/labelStore';
import type { CustomerData } from '../constants/customers';
import { User, X } from 'lucide-react';
import { searchCustomersByPhone } from '../app/actions/customers';
import { NETWORK_ERROR_MESSAGE } from '../lib/api/types';

type SearchStatus = 'idle' | 'loading' | 'error' | 'done';

export function CustomerSearchInput() {
  const { customerName, setCustomerName, setCustomerPhone } = useLabelStore();
  const [searchTerm, setSearchTerm] = useState(customerName || '');
  const [results, setResults] = useState<CustomerData[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSearchTerm(customerName || '');
  }, [customerName]);

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

  const handleSelectCustomer = (c: { name: string; phone_number: string }) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone_number);
    setSearchTerm(c.name);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  // Only saved patients from the API are offered; a failed search is shown as an error.
  const runSearch = async (term: string) => {
    const requestId = ++requestIdRef.current;
    setSearchStatus('loading');
    setSearchError(null);
    let res: Awaited<ReturnType<typeof searchCustomersByPhone>>;
    try {
      res = await searchCustomersByPhone(term);
    } catch {
      res = { ok: false, error: NETWORK_ERROR_MESSAGE };
    }
    if (requestId !== requestIdRef.current) return; // a newer search superseded this one
    if (res.ok) {
      setResults(res.data);
      setSearchStatus('done');
    } else {
      setResults([]);
      setSearchError(res.error);
      setSearchStatus('error');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    setCustomerName(val); // Allow free typing of customer name
    setSelectedIndex(-1);
    setIsOpen(true);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (val.trim().length > 1) {
      debounceTimerRef.current = setTimeout(() => runSearch(val), 250);
    } else {
      requestIdRef.current++;
      setResults([]);
      setSearchStatus('idle');
      setSearchError(null);
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleClear = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    requestIdRef.current++;
    setSearchTerm('');
    setCustomerName('');
    setCustomerPhone('');
    setResults([]);
    setSearchStatus('idle');
    setSearchError(null);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
      if (isOpen && selectedIndex >= 0 && results[selectedIndex]) {
        e.preventDefault();
        handleSelectCustomer(results[selectedIndex]);
      } else if (isOpen && results.length === 1) {
        e.preventDefault();
        handleSelectCustomer(results[0]);
      }
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full relative flex items-center">
      {/* Customer Card Content */}
      <div 
        onClick={() => inputRef.current?.focus()}
        className="w-full h-full bg-white border border-border rounded-ui-lg px-3 py-2 flex items-center gap-3 shadow-card hover:border-primary-border transition-colors cursor-text"
      >
        {/* Solid Blue Squircle with User Icon */}
        <div className="w-11 h-11 rounded-ui-lg bg-primary flex items-center justify-center text-white shrink-0 shadow-sm">
          <User size={22} className="text-white" />
        </div>

        {/* Text Input Stack */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="text-sm font-bold text-fg leading-tight">
            Customer Name / Mobile
          </div>
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={handleChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder="Search or enter patient name / mobile..."
            className="w-full bg-transparent text-xs text-muted font-medium outline-none placeholder:text-subtle leading-tight mt-0.5"
          />
        </div>

        {/* Clear Button */}
        {searchTerm && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="w-7 h-7 flex items-center justify-center text-subtle hover:text-fg active:text-black select-none touch-manipulation rounded-full hover:bg-surface-2 shrink-0"
            title="Clear customer"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* DROPDOWN */}
      {isOpen && searchStatus !== 'idle' && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white border border-border rounded-ui-lg z-50 max-h-[340px] overflow-y-auto shadow-pop py-1">
          {searchStatus === 'loading' ? (
            <div role="status" className="p-3 text-center bg-surface">
              <p className="text-xs font-medium text-subtle">Searching saved patients…</p>
            </div>
          ) : searchStatus === 'error' ? (
            <div role="alert" className="p-3 text-center bg-danger-soft space-y-2">
              <p className="text-xs font-semibold text-danger">
                Patient search failed: {searchError}
              </p>
              <button
                type="button"
                onClick={() => runSearch(searchTerm)}
                className="px-3 py-1.5 text-xs font-bold bg-white border border-danger-border text-danger rounded-lg hover:bg-danger-soft touch-manipulation"
              >
                Retry
              </button>
            </div>
          ) : results.length > 0 ? (
            results.map((c, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={c.id || index}
                  type="button"
                  onClick={() => handleSelectCustomer(c)}
                  className={`w-full text-left px-4 py-2.5 border-b border-surface last:border-b-0 transition-colors touch-manipulation flex items-center justify-between ${
                    isSelected
                      ? 'bg-primary-soft border-l-4 border-l-primary'
                      : 'hover:bg-surface active:bg-surface-2'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-fg leading-tight">
                      {c.name}
                    </span>
                    <span className="text-xs font-mono text-subtle mt-0.5">
                      {c.phone_number}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 bg-primary-soft text-primary rounded-md border border-primary-border">
                    SELECT
                  </span>
                </button>
              );
            })
          ) : (
            <div className="p-3 text-center bg-surface">
              <p className="text-xs font-medium text-subtle">
                No saved customer for "{searchTerm}". You can continue typing to save a new name.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
