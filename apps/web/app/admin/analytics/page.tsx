'use client';

import type { ApiData } from '@/lib/api/types';
import React, { useState } from 'react';
import { TrendingUp, BarChart3, Users, Printer, FileText, Package, Clock, ShieldAlert, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getAdminSummary, getAdminActivity, getAdminTopProducts, getAdminStatusBreakdown } from '@/app/actions/admin';
import { getInventorySummary, getInventoryLowStock } from '@/app/actions/inventory';
import FilterTabs from '@/components/admin/FilterTabs';
import StatCard from '@/components/admin/StatCard';
import UnverifiedDataNotice from '@/components/admin/UnverifiedDataNotice';
import { ErrorState, LoadingState, MISSING } from '@/components/admin/DataState';
import { useApiQuery, type QueryState } from '@/lib/useApiQuery';

const TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  borderColor: '#E2E8F0',
  borderRadius: '10px',
  fontSize: '11px',
  fontWeight: 700,
};

const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981',
  draft: '#3B82F6',
  cancelled: '#EF4444',
};

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function kpiValue(query: QueryState<ApiData>, value: unknown) {
  if (query.status === 'loading') return '…';
  if (query.status === 'error') return MISSING;
  return isNum(value) ? value.toLocaleString() : MISSING;
}

function Panel({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
      <div className="pb-3 border-b border-slate-100 mb-3">
        <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
          <Icon className="w-4 h-4 text-[#2563EB]" />
          <span>{title}</span>
        </h3>
        {subtitle && <p className="text-[11px] text-[#64748B] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function QueryBody<T>({
  query,
  isEmpty,
  emptyText,
  children,
}: {
  query: QueryState<T>;
  isEmpty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  if (query.status === 'loading') return <LoadingState label="Loading…" />;
  if (query.status === 'error') return <ErrorState title="Could not load" message={query.error} onRetry={query.retry} compact />;
  if (isEmpty) return <p className="text-center text-slate-500 py-12 text-xs font-semibold">{emptyText}</p>;
  return <>{children}</>;
}

export default function AnalyticsDashboardPage() {
  const [range, setRange] = useState('30d');

  const summaryQuery = useApiQuery(() => getAdminSummary(), []);
  const activityQuery = useApiQuery(() => getAdminActivity(range), [range]);
  const topQuery = useApiQuery(() => getAdminTopProducts(range, 6), [range]);
  const statusQuery = useApiQuery(() => getAdminStatusBreakdown(), []);
  const invQuery = useApiQuery(() => getInventorySummary(), []);
  const lowStockQuery = useApiQuery(() => getInventoryLowStock(), []);

  const today = summaryQuery.data?.today;
  const activity = (activityQuery.data ?? []).map((d: ApiData) => ({
    date: d.date ?? d.day ?? '',
    prescriptions: isNum(d.prescriptions) ? d.prescriptions : null,
    labels: isNum(d.labels) ? d.labels : null,
  }));
  const topProducts = (topQuery.data ?? []).filter((p: ApiData) => p?.name && isNum(p.dispensed));

  const rxStatusData = (Array.isArray(statusQuery.data?.status) ? statusQuery.data.status : [])
    .filter((s: ApiData) => s?.name && isNum(s.value))
    .map((s: ApiData) => ({ name: s.name, value: s.value, color: STATUS_COLORS[String(s.name).toLowerCase()] ?? '#64748B' }));
  const totalRxStatus = rxStatusData.reduce((acc: number, cur: { value: number }) => acc + cur.value, 0);
  const timeOfDay = (Array.isArray(statusQuery.data?.timeOfDay) ? statusQuery.data.timeOfDay : []).filter(
    (t: ApiData) => t?.period && isNum(t.count),
  );

  const expiry = invQuery.data?.expiry;
  const expiryData = [
    { range: 'Expired', count: expiry?.expired, color: '#991B1B' },
    { range: '0–30 days', count: expiry?.within30Days, color: '#EF4444' },
    { range: '31–60 days', count: expiry?.within60Days, color: '#F97316' },
    { range: '61–90 days', count: expiry?.within90Days, color: '#F59E0B' },
  ].filter((e) => isNum(e.count));

  const lowStock = (lowStockQuery.data ?? [])
    .map((p: ApiData) => ({ name: p.name, current: p.stock_quantity ?? p.remaining, reorder: p.reorder_level }))
    .filter((p: ApiData) => p.name && isNum(p.current))
    .slice(0, 6);

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {/* HEADER WITH TIME RANGE FILTERS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/88 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shrink-0">
            <BarChart3 className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">Analytics</h1>
            <p className="text-xs sm:text-[13px] font-medium text-[#64748B] mt-0.5">
              Dispensing activity, prescription status, expiry risk and low stock.
            </p>
          </div>
        </div>

        <FilterTabs
          tabs={[
            { id: '7d', label: '7 Days' },
            { id: '30d', label: '30 Days' },
            { id: '90d', label: '90 Days' },
            { id: '1y', label: '1 Year' },
          ]}
          activeTab={range}
          onChange={(r) => setRange(r)}
        />
      </div>

      <UnverifiedDataNotice />

      {/* KPI ROW (today) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Prescriptions Today" value={kpiValue(summaryQuery, today?.prescriptions)} subtext="Recorded today" subtextColor="slate" icon={FileText} variant="blue" />
        <StatCard title="Labels Printed Today" value={kpiValue(summaryQuery, today?.labelsPrinted)} subtext="Printed today" subtextColor="slate" icon={Printer} variant="green" />
        <StatCard title="Patients Served Today" value={kpiValue(summaryQuery, today?.patientsServed)} subtext="Served today" subtextColor="slate" icon={Users} variant="purple" />
        <StatCard title="Items Dispensed Today" value={kpiValue(summaryQuery, today?.itemsDispensed)} subtext="Units dispensed today" subtextColor="slate" icon={Package} variant="red" />
      </div>
      {summaryQuery.status === 'error' && (
        <div className="bg-white rounded-2xl border border-slate-200">
          <ErrorState title="Could not load today's figures" message={summaryQuery.error} onRetry={summaryQuery.retry} compact />
        </div>
      )}

      {/* ROW 1: ACTIVITY + STATUS DONUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8">
          <Panel title="Prescription & Label Activity" subtitle="Prescriptions recorded and labels printed" icon={TrendingUp}>
            <QueryBody query={activityQuery} isEmpty={activity.length === 0} emptyText="No activity recorded for this period.">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={activity} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="prescriptions" name="Prescriptions" fill="#2563EB" radius={[5, 5, 0, 0]} maxBarSize={36} />
                    <Line type="monotone" dataKey="labels" name="Labels Printed" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </QueryBody>
          </Panel>
        </div>

        <div className="lg:col-span-4">
          <Panel title="Prescription Status" subtitle="All recorded prescriptions" icon={FileText}>
            <QueryBody query={statusQuery} isEmpty={totalRxStatus === 0} emptyText="No prescriptions recorded yet.">
              <div className="relative w-full h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={rxStatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {rxStatusData.map((entry: ApiData, i: number) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-extrabold text-[#0F172A]">{totalRxStatus.toLocaleString()}</span>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total</span>
                </div>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                {rxStatusData.map((s: ApiData) => (
                  <div key={s.name} className="flex items-center justify-between text-xs font-semibold p-1">
                    <span className="flex items-center gap-2 text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {s.value} <span className="text-slate-400 font-medium">({Math.round((s.value / totalRxStatus) * 100)}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </QueryBody>
          </Panel>
        </div>
      </div>

      {/* ROW 2: TOP MEDICINES + TIME OF DAY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Top Dispensed Medicines" subtitle="Ranked by units dispensed in this period" icon={Package}>
          <QueryBody query={topQuery} isEmpty={topProducts.length === 0} emptyText="No dispensing recorded for this period.">
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={topProducts} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(val: ApiData) => [`${val} units`, 'Dispensed']} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="dispensed" fill="#2563EB" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </QueryBody>
        </Panel>

        <Panel title="Prescriptions by Time of Day" subtitle="When prescriptions are recorded" icon={Clock}>
          <QueryBody query={statusQuery} isEmpty={timeOfDay.length === 0} emptyText="No time-of-day data available.">
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeOfDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" name="Prescriptions" fill="#4F46E5" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </QueryBody>
        </Panel>
      </div>

      {/* ROW 3: EXPIRY RISK + LOW STOCK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Expiry Risk" subtitle="Batches by time to expiry" icon={ShieldAlert}>
          <QueryBody query={invQuery} isEmpty={expiryData.length === 0} emptyText="No expiry data available.">
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expiryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" name="Batches" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {expiryData.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </QueryBody>
        </Panel>

        <Panel title="Low Stock" subtitle="Current stock against reorder level" icon={AlertTriangle}>
          <QueryBody query={lowStockQuery} isEmpty={lowStock.length === 0} emptyText="No products at or below reorder level.">
            <div className="space-y-3">
              {lowStock.map((p: ApiData, i: number) => {
                const pct = isNum(p.reorder) && p.reorder > 0 ? Math.min(100, Math.round((p.current / p.reorder) * 100)) : null;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 truncate">{p.name}</span>
                      <span className="font-mono font-semibold text-slate-600 shrink-0">
                        {p.current} / {isNum(p.reorder) ? p.reorder : MISSING}
                      </span>
                    </div>
                    {pct !== null && (
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                        <div className="h-full rounded-full bg-rose-500" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </QueryBody>
        </Panel>
      </div>
    </div>
  );
}
