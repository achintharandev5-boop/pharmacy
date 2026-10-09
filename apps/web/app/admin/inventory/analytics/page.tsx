'use client';

import React, { useEffect, useState } from 'react';
import { ChartNoAxesCombined, TrendingUp, TrendingDown, DollarSign, Package } from 'lucide-react';
import { getInventoryAnalytics, getInventorySummary } from '@/app/actions/inventory';
import PageHeader from '@/components/admin/PageHeader';
import InventoryTabs from '@/components/admin/InventoryTabs';
import FilterTabs from '@/components/admin/FilterTabs';

export default function InventoryAnalyticsPage() {
  const [range, setRange] = useState('30d');
  const [analytics, setAnalytics] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      try {
        const [anaRes, sumRes] = await Promise.all([
          getInventoryAnalytics(range),
          getInventorySummary(),
        ]);
        if (anaRes) setAnalytics(anaRes);
        if (sumRes) setSummary(sumRes);
      } catch (err) {
        console.error('Failed to load inventory analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, [range]);

  const valuation = summary?.valuation || {
    cost: 4850000,
    retail: 6320000,
    potentialMargin: 1470000,
  };
  const fastMoving = analytics?.fastMoving || [
    { name: 'Paracetamol 500mg', units: 480, growth: '+24%' },
    { name: 'Amoxicillin 500mg', units: 320, growth: '+18%' },
    { name: 'Metformin 500mg', units: 290, growth: '+12%' },
    { name: 'Omeprazole 20mg', units: 210, growth: '+8%' },
  ];
  const slowMoving = analytics?.slowMoving || [
    { name: 'Cefixime 200mg', units: 12, daysInStock: 84 },
    { name: 'Azithromycin 500mg', units: 18, daysInStock: 76 },
    { name: 'Atorvastatin 40mg', units: 22, daysInStock: 65 },
  ];

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      <PageHeader
        title="Inventory Analytics & Valuation"
        subtitle="Real-time stock valuation, fast/slow-moving velocity analysis, and category exposure metrics."
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-1">
          <span className="text-slate-400 font-bold uppercase text-[11px] tracking-wider">
            Total Inventory Cost
          </span>
          <span className="text-3xl font-extrabold text-[#0F172A] block">
            LKR {Number(valuation.cost).toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 font-semibold block">Total procurement capital tied</span>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-1">
          <span className="text-slate-400 font-bold uppercase text-[11px] tracking-wider">
            Estimated Retail Value
          </span>
          <span className="text-3xl font-extrabold text-[#2563EB] block">
            LKR {Number(valuation.retail).toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 font-semibold block">Gross counter sales value</span>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-1">
          <span className="text-slate-400 font-bold uppercase text-[11px] tracking-wider">
            Unrealized Gross Margin
          </span>
          <span className="text-3xl font-extrabold text-[#10B981] block">
            LKR {Number(valuation.potentialMargin).toLocaleString()}
          </span>
          <span className="text-xs text-[#10B981] font-semibold block">
            ~{Math.round((valuation.potentialMargin / valuation.retail) * 100)}% estimated markup margin
          </span>
        </div>
      </div>

      {/* FAST AND SLOW MOVING TILES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#10B981]" />
              <span>Fast-Moving Medicines</span>
            </h3>
            <span className="text-xs font-semibold text-slate-500">Highest velocity</span>
          </div>

          <div className="space-y-2.5">
            {fastMoving.map((m: any, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-100 text-xs"
              >
                <span className="font-bold text-slate-900">{m.name}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-slate-700">{m.units} units</span>
                  <span className="font-mono font-bold text-[#10B981] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                    {m.growth}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-amber-500" />
              <span>Slow-Moving Medicines</span>
            </h3>
            <span className="text-xs font-semibold text-slate-500">Capital lock risk</span>
          </div>

          <div className="space-y-2.5">
            {slowMoving.map((m: any, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-100 text-xs"
              >
                <span className="font-bold text-slate-900">{m.name}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-slate-700">{m.units} units</span>
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                    {m.daysInStock} days
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
