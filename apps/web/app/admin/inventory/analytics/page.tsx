'use client';

import type { ApiData } from '@/lib/api/types';
import React, { useState } from 'react';
import { ChartNoAxesCombined, TrendingUp, TrendingDown } from 'lucide-react';
import { getInventoryAnalytics, getInventorySummary } from '@/app/actions/inventory';
import PageHeader from '@/components/admin/PageHeader';
import InventoryTabs from '@/components/admin/InventoryTabs';
import FilterTabs from '@/components/admin/FilterTabs';
import { ErrorState, LoadingState, MISSING } from '@/components/admin/DataState';
import { useApiQuery } from '@/lib/useApiQuery';

function formatLkr(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? `LKR ${value.toLocaleString()}` : MISSING;
}

export default function InventoryAnalyticsPage() {
  const [range, setRange] = useState('30d');
  const summaryQuery = useApiQuery(() => getInventorySummary(), []);
  const analyticsQuery = useApiQuery(() => getInventoryAnalytics(range), [range]);

  const valuation = summaryQuery.data?.valuation;
  const marginPct =
    typeof valuation?.potentialMargin === 'number' && typeof valuation?.retail === 'number' && valuation.retail > 0
      ? Math.round((valuation.potentialMargin / valuation.retail) * 100)
      : null;
  const fastMoving: ApiData[] = Array.isArray(analyticsQuery.data?.fastMoving) ? analyticsQuery.data.fastMoving : [];
  const slowMoving: ApiData[] = Array.isArray(analyticsQuery.data?.slowMoving) ? analyticsQuery.data.slowMoving : [];

  const valuationCards = [
    { label: 'Total Inventory Cost', value: formatLkr(valuation?.cost), note: 'Stock at purchase cost', tone: 'text-[#0F172A]' },
    { label: 'Estimated Retail Value', value: formatLkr(valuation?.retail), note: 'Stock at retail price', tone: 'text-[#2563EB]' },
    {
      label: 'Unrealized Gross Margin',
      value: formatLkr(valuation?.potentialMargin),
      note: marginPct !== null ? `~${marginPct}% of retail value` : 'Retail value minus cost',
      tone: 'text-[#10B981]',
    },
  ];

  const renderMovers = (list: ApiData[], kind: 'fast' | 'slow') => {
    if (analyticsQuery.status === 'loading') return <LoadingState label="Loading…" />;
    if (analyticsQuery.status === 'error') {
      return <ErrorState title="Could not load analytics" message={analyticsQuery.error} onRetry={analyticsQuery.retry} compact />;
    }
    if (list.length === 0) {
      return <p className="text-center text-slate-500 py-6 text-xs font-semibold">No data for this period.</p>;
    }
    return list.map((m: ApiData, i: number) => (
      <div key={m.id || i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-100 text-xs">
        <span className="font-bold text-slate-900">{m.name || MISSING}</span>
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-slate-700">{m.units ?? MISSING} units</span>
          {kind === 'fast' && m.growth && (
            <span className="font-mono font-bold text-[#10B981] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{m.growth}</span>
          )}
          {kind === 'slow' && m.daysInStock !== undefined && m.daysInStock !== null && (
            <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
              {m.daysInStock} days
            </span>
          )}
        </div>
      </div>
    ));
  };

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      <PageHeader
        title="Inventory Analytics & Valuation"
        subtitle="Stock valuation and fast/slow-moving medicines."
        icon={ChartNoAxesCombined}
      />

      <InventoryTabs />

      {/* FILTER TABS */}
      <div className="bg-white/88 backdrop-blur-md p-2 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          tabs={[
            { id: '7d', label: '7 Days' },
            { id: '30d', label: '30 Days' },
            { id: '90d', label: '3 Months' },
            { id: '180d', label: '6 Months' },
          ]}
          activeTab={range}
          onChange={(r) => setRange(r)}
        />
      </div>

      {/* VALUATION ROW */}
      {summaryQuery.status === 'error' ? (
        <div className="bg-white rounded-2xl border border-slate-200">
          <ErrorState title="Could not load stock valuation" message={summaryQuery.error} onRetry={summaryQuery.retry} compact />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5" aria-busy={summaryQuery.status === 'loading'}>
          {valuationCards.map((card) => (
            <div
              key={card.label}
              className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-1"
            >
              <span className="text-slate-400 font-bold uppercase text-[11px] tracking-wider">{card.label}</span>
              <span className={`text-3xl font-extrabold block ${card.tone}`}>
                {summaryQuery.status === 'loading' ? (
                  <span className="inline-block h-8 w-28 rounded bg-slate-100 animate-pulse" aria-hidden="true" />
                ) : (
                  card.value
                )}
              </span>
              <span className="text-xs text-slate-500 font-semibold block">{card.note}</span>
            </div>
          ))}
        </div>
      )}

      {/* FAST AND SLOW MOVING */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#10B981]" />
              <span>Fast-Moving Medicines</span>
            </h3>
            <span className="text-xs font-semibold text-slate-500">Most units dispensed</span>
          </div>
          <div className="space-y-2.5">{renderMovers(fastMoving, 'fast')}</div>
        </div>

        <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-amber-500" />
              <span>Slow-Moving Medicines</span>
            </h3>
            <span className="text-xs font-semibold text-slate-500">Fewest units dispensed</span>
          </div>
          <div className="space-y-2.5">{renderMovers(slowMoving, 'slow')}</div>
        </div>
      </div>
    </div>
  );
}
