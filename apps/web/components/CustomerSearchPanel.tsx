'use client';
import React, { useState } from 'react';
import { useLabelStore } from '../store/labelStore';
import { searchCustomersByPhone } from '../app/actions/customers';
import { NETWORK_ERROR_MESSAGE } from '../lib/api/types';

export function CustomerSearchPanel() {
  const { setCustomerSearchVisible, setCustomerName, setCustomerPhone } = useLabelStore();
  const [phone, setPhone] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!phone.trim() || loading) return;
    setLoading(true);
    setSearched(false);
    setSearchError(null);

    let res: Awaited<ReturnType<typeof searchCustomersByPhone>>;
    try {
      res = await searchCustomersByPhone(phone);
    } catch {
      res = { ok: false, error: NETWORK_ERROR_MESSAGE };
    }
    if (res.ok) {
      setResults(res.data);
    } else {
      setResults([]);
      setSearchError(res.error);
    }

    setSearched(true);
    setLoading(false);
  };

  const handleSelect = (name: string, phoneNum?: string) => {
    setCustomerName(name);
    if (phoneNum) {
      setCustomerPhone(phoneNum);
    } else if (phone.trim()) {
      setCustomerPhone(phone.trim());
    }
    setCustomerSearchVisible(false);
  };

  const append = (d: string) => setPhone((prev) => prev + d);
  const backspace = () => setPhone((prev) => prev.slice(0, -1));
  const clearPhone = () => {
    setPhone('');
    setResults([]);
    setSearched(false);
    setSearchError(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 select-none touch-manipulation">
      <div className="bg-white w-[min(900px,92vw)] max-h-[85dvh] border-2 border-border-strong rounded-none shadow-none overflow-hidden flex flex-col">
        
        {/* HEADER */}
        <div className="h-[64px] bg-primary text-white px-5 flex items-center justify-between shrink-0 select-none">
          <h2 className="text-xl lg:text-2xl font-black uppercase tracking-wide">
            CUSTOMER SEARCH
          </h2>
          <button 
            type="button"
            onClick={() => setCustomerSearchVisible(false)} 
            className="w-[56px] h-[56px] flex items-center justify-center font-black text-2xl hover:bg-white/20 active:bg-white/30 text-white rounded-none transition-all touch-manipulation active:scale-[0.98]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        
        {/* BODY */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">

          {/* SEARCH FIELD */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-black tracking-wider text-subtle uppercase block">
              PHONE NUMBER
            </label>
            <form onSubmit={handleSearch} className="flex gap-2 w-full">
              <input 
                type="tel" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter phone number..."
                className="h-[62px] flex-1 bg-surface border border-border-strong rounded-none px-4 text-2xl font-bold text-fg outline-none focus:border-2 focus:border-primary placeholder:text-subtle touch-manipulation"
              />
              <button 
                type="submit" 
                disabled={!phone.trim() || loading}
                className="h-[62px] min-w-[140px] bg-primary hover:bg-primary-hover active:bg-primary-hover disabled:opacity-40 text-white font-black text-lg rounded-none transition-all touch-manipulation active:scale-[0.98]"
              >
                {loading ? 'SEARCHING...' : 'SEARCH'}
              </button>
            </form>
          </div>

          {/* CONVENTIONAL NUMERIC KEYPAD */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button 
                key={d} 
                type="button"
                onClick={() => append(d)} 
                className="h-[72px] bg-surface text-fg font-black text-3xl border border-border-strong rounded-none hover:bg-surface-2 active:bg-border flex items-center justify-center transition-all select-none touch-manipulation active:scale-[0.98]"
              >
                {d}
              </button>
            ))}

            {/* Backspace */}
            <button 
              type="button"
              onClick={backspace} 
              className="h-[72px] bg-danger-soft text-danger font-black text-2xl border border-danger-border rounded-none hover:bg-danger-soft active:bg-[#FCA5A5] flex items-center justify-center transition-all select-none touch-manipulation active:scale-[0.98]"
              title="Backspace"
            >
              ⌫
            </button>

            {/* 0 */}
            <button 
              type="button"
              onClick={() => append('0')} 
              className="h-[72px] bg-surface text-fg font-black text-3xl border border-border-strong rounded-none hover:bg-surface-2 active:bg-border flex items-center justify-center transition-all select-none touch-manipulation active:scale-[0.98]"
            >
              0
            </button>

            {/* Clear */}
            <button 
              type="button"
              onClick={clearPhone} 
              className="h-[72px] bg-danger-soft text-danger font-black text-lg border border-danger-border rounded-none hover:bg-danger-soft active:bg-[#FCA5A5] flex items-center justify-center transition-all select-none touch-manipulation active:scale-[0.98]"
            >
              CLEAR
            </button>
          </div>

          {/* DYNAMIC RESULTS SECTION */}
          {(loading || searched) && (
            <div className="mt-2 border-t border-border-strong pt-3 flex flex-col gap-2">
              <span className="text-xs font-black text-primary uppercase tracking-wider block">
                SEARCH RESULTS
              </span>

              {loading && (
                <div className="p-6 bg-primary-soft border border-primary-border text-primary font-black text-xl text-center animate-pulse">
                  SEARCHING FOR {phone}...
                </div>
              )}

              {!loading && searched && searchError && (
                <div role="alert" className="bg-danger-soft border-2 border-danger-border p-5 rounded-none flex flex-col items-center justify-center text-center gap-2">
                  <span className="text-xl font-black text-danger uppercase">
                    SEARCH FAILED
                  </span>
                  <span className="text-base font-bold text-muted">{searchError}</span>
                  <button
                    type="button"
                    onClick={() => handleSearch()}
                    className="mt-1 h-[52px] px-8 bg-white border-2 border-danger text-danger font-black text-base rounded-none hover:bg-danger-soft active:bg-danger-border transition-all touch-manipulation active:scale-[0.98]"
                  >
                    RETRY
                  </button>
                </div>
              )}

              {!loading && searched && !searchError && results.length === 0 && (
                <div className="bg-danger-soft border-2 border-danger-border p-5 rounded-none flex flex-col items-center justify-center text-center gap-2">
                  <span className="text-xl font-black text-danger uppercase">
                    CUSTOMER NOT FOUND
                  </span>
                  <span className="text-base font-bold text-muted">
                    No customer was found for: <span className="font-black text-fg">{phone}</span>
                  </span>
                  <span className="text-xs font-semibold text-subtle">
                    You can type the name directly in the Customer Name field on the main label panel.
                  </span>
                </div>
              )}

              {!loading && results.length > 0 && (
                <div className="max-h-[260px] overflow-y-auto flex flex-col gap-2 pr-1">
                  {results.map((r) => (
                    <div 
                      key={r.id} 
                      onClick={() => handleSelect(r.name, r.phone_number)}
                      className="min-h-[68px] bg-white border border-border-strong hover:border-primary hover:bg-primary-soft active:bg-primary-border p-3 px-5 flex items-center justify-between cursor-pointer transition-all touch-manipulation"
                    >
                      <div className="flex flex-col justify-center">
                        <span className="text-xl font-extrabold text-fg">{r.name}</span>
                        <span className="text-base font-bold text-muted">{r.phone_number}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(r.name, r.phone_number);
                        }}
                        className="h-[46px] px-6 bg-success hover:bg-success active:bg-success text-white font-black text-base rounded-none border border-success transition-all touch-manipulation active:scale-[0.98]"
                      >
                        SELECT
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
