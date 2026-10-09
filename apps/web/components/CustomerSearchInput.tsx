'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useLabelStore } from '../store/labelStore';
import { HARDCODED_CUSTOMERS, CustomerData } from '../constants/customers';
import { User, X } from 'lucide-react';
import { searchCustomersByPhone } from '../app/actions/customers';

function filterCustomers(query: string, list: CustomerData[]): CustomerData[] {
  const q = query.trim().toLowerCase().replace(/[\s\-]/g, '');
  if (!q) return list;

  return list.filter((c) => {
    const nameMatch = c.name.toLowerCase().includes(q);
    const phoneMatch = c.phone_number.replace(/[\s\-]/g, '').includes(q);
    return nameMatch || phoneMatch;
  });
}

export function CustomerSearchInput() {
  const { customerName, setCustomerName, setCustomerPhone } = useLabelStore();
  const [searchTerm, setSearchTerm] = useState(customerName || '');
  const [results, setResults] = useState<CustomerData[]>(HARDCODED_CUSTOMERS);
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    setCustomerName(val); // Allow free typing of customer name
    setSelectedIndex(-1);

    const localMatches = filterCustomers(val, HARDCODED_CUSTOMERS);
    setResults(localMatches);
    setIsOpen(true);

    // Also query backend if digits/phone or text
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (val.trim().length > 1) {
      debounceTimerRef.current = setTimeout(async () => {
        const res = await searchCustomersByPhone(val);
        if (res.data && Array.isArray(res.data)) {
          const merged = [...localMatches];
          for (const item of res.data) {
            if (!merged.some((c) => c.phone_number === item.phone_number)) {
              merged.push(item);
            }
          }
          setResults(merged);
        }
      }, 250);
    }
  };

  const handleFocus = () => {
    const filtered = filterCustomers(searchTerm, HARDCODED_CUSTOMERS);
    setResults(filtered);
    setIsOpen(true);
  };

  const handleClear = () => {
    setSearchTerm('');
    setCustomerName('');
    setCustomerPhone('');
    setResults(HARDCODED_CUSTOMERS);
    setIsOpen(true);
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
        className="w-full h-full bg-white border border-[#DCE7F5] rounded-2xl px-3 py-2 flex items-center gap-3 shadow-[0_2px_8px_rgba(15,23,42,0.03)] hover:border-[#BFDBFE] transition-colors cursor-text"
      >
        {/* Solid Blue Squircle with User Icon */}
        <div className="w-11 h-11 rounded-xl bg-[#2563EB] flex items-center justify-center text-white shrink-0 shadow-sm">
          <User size={22} className="text-white" />
        </div>

        {/* Text Input Stack */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="text-sm font-bold text-[#0F172A] leading-tight">
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
            className="w-full bg-transparent text-xs text-[#475569] font-medium outline-none placeholder:text-[#94A3B8] leading-tight mt-0.5"
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
            className="w-7 h-7 flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] active:text-black select-none touch-manipulation rounded-full hover:bg-[#F1F5F9] shrink-0"
            title="Clear customer"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* DROPDOWN */}
      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white border border-[#DCE7F5] rounded-2xl z-50 max-h-[340px] overflow-y-auto shadow-xl py-1">
          {results.length > 0 ? (
            results.map((c, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={c.id || index}
                  type="button"
                  onClick={() => handleSelectCustomer(c)}
                  className={`w-full text-left px-4 py-2.5 border-b border-[#F8FAFC] last:border-b-0 transition-colors touch-manipulation flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#EFF6FF] border-l-4 border-l-[#2563EB]'
                      : 'hover:bg-[#F8FAFC] active:bg-[#F1F5F9]'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-[#0F172A] leading-tight">
                      {c.name}
                    </span>
                    <span className="text-xs font-mono text-slate-500 mt-0.5">
                      {c.phone_number}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 bg-[#EFF6FF] text-[#2563EB] rounded-md border border-[#BFDBFE]">
                    SELECT
                  </span>
                </button>
              );
            })
          ) : (
            <div className="p-3 text-center bg-[#F8FAFC]">
              <p className="text-xs font-medium text-slate-500">
                No saved customer for "{searchTerm}". You can continue typing to save a new name.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
