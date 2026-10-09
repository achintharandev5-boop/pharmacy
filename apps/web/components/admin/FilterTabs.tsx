'use client';

import React from 'react';

export interface TabOption {
  id: string;
  label: string;
  count?: number;
}

interface FilterTabsProps {
  tabs: (string | TabOption)[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export default function FilterTabs({
  tabs,
  activeTab,
  onChange,
  className = '',
}: FilterTabsProps) {
  return (
    <div
      className={`inline-flex items-center gap-1 bg-[#F1F5F9]/80 p-1 rounded-xl border border-slate-200/60 select-none ${className}`}
    >
      {tabs.map((tab) => {
        const id = typeof tab === 'string' ? tab : tab.id;
        const label = typeof tab === 'string' ? tab : tab.label;
        const count = typeof tab === 'object' ? tab.count : undefined;
        const isActive = activeTab.toLowerCase() === id.toLowerCase();

        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 flex items-center gap-1.5 ${
              isActive
                ? 'bg-white text-[#2563EB] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white/50'
            }`}
          >
            <span>{label}</span>
            {count !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? 'bg-blue-50 text-[#2563EB]' : 'bg-slate-200/70 text-slate-600'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
