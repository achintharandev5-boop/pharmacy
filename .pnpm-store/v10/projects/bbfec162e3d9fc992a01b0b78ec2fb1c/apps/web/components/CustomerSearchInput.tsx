'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useLabelStore } from '../store/labelStore';
import type { CustomerData } from '../constants/customers';
import { User, X, Grid3x3, Loader2 } from 'lucide-react';
import { searchCustomersByPhone } from '../app/actions/customers';
import { NETWORK_ERROR_MESSAGE } from '../lib/api/types';
import { TOOLBAR_FIELD, TOOLBAR_ICON_BUTTON, TOOLBAR_ICON_BUTTON_ACCENT, TOOLBAR_INPUT, TOOLBAR_LABEL } from './label/toolbarStyles';

type SearchStatus = 'idle' | 'loading' | 'error' | 'done';

export function CustomerSearchInput() {
  const { customerName, setCustomerName, setCustomerPhone, setCustomerSearchVisible } = useLabelStore();
  const searchTerm = customerName || '';
  const [results, setResults] = useState<CustomerData[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  const handleSelectCustomer = (c: { name: string; phone_number: string }) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone_number);
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
        className={TOOLBAR_FIELD}
      >
        <span className="shrink-0 text-subtle" aria-hidden="true">
          {searchStatus === 'loading'
            ? <Loader2 size={18} className="text-primary animate-spin" />
            : <User size={18} />}
        </span>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <label htmlFor="patient-search" className={TOOLBAR_LABEL}>
            Patient / Mobile
          </label>
          <input
            id="patient-search"
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={handleChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder="Name or mobile number"
            className={TOOLBAR_INPUT}
          />
        </div>

        {searchTerm && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className={TOOLBAR_ICON_BUTTON}
            aria-label="Clear patient"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}

        {/* Mobile-number keypad lookup (touch screens have no keyboard). */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCustomerSearchVisible(true);
          }}
          aria-label="Find patient by mobile number (keypad)"
          title="Find by mobile number"
          className={TOOLBAR_ICON_BUTTON_ACCENT}
        >
          <Grid3x3 size={18} aria-hidden="true" />
        </button>
      </div>

      {/* DROPDOWN */}
      {isOpen && searchStatus !== 'idle' && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-page border border-border rounded-ui-lg z-50 max-h-[340px] overflow-y-auto shadow-pop py-1">
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
                className="px-3 py-1.5 text-xs font-bold bg-page border border-danger-border text-danger rounded-lg hover:bg-danger-soft touch-manipulation"
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
                No saved customer for &quot;{searchTerm}&quot;. You can continue typing to save a new name.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
