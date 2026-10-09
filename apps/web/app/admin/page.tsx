'use client';

import type { ApiData } from '@/lib/api/types';
import React, { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Printer,
  Package,
  TriangleAlert,
  ArrowRight,
  Calendar,
  Clock,
  Boxes,
  TrendingUp,
  FileSpreadsheet,
  AlertTriangle,
  FileText,
} from 'lucide-react';
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
import { getAdminSummary, getAdminActivity, getAdminTopProducts } from '@/app/actions/admin';
import { getPrescriptionHistory } from '@/app/actions/prescriptions';
import { getInventorySummary, getInventoryLowStock } from '@/app/actions/inventory';
import StatCard from '@/components/admin/StatCard';
import QuickActionCard from '@/components/admin/QuickActionCard';
import StatusBadge from '@/components/admin/StatusBadge';
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

function kpiValue(query: QueryState<ApiData>, value: unknown) {
  if (query.status === 'loading') return '…';
  if (query.status === 'error') return MISSING;
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : MISSING;
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export default function AdminDashboardPage() {
  const [activityRange, setActivityRange] = useState<'7d' | '30d' | '90d' | '1y'>('7d');

  const summaryQuery = useApiQuery(() => getAdminSummary(), []);
  const inventoryQuery = useApiQuery(() => getInventorySummary(), []);
  const activityQuery = useApiQuery(() => getAdminActivity(activityRange), [activityRange]);
  const topProductsQuery = useApiQuery(() => getAdminTopProducts(activityRange, 5), [activityRange]);
  const recentQuery = useApiQuery(() => getPrescriptionHistory(), []);
  const lowStockQuery = useApiQuery(() => getInventoryLowStock(), []);

  const summary = summaryQuery.data;
  const inventory = inventoryQuery.data;
  const activityData = (activityQuery.data ?? []).map((d: ApiData) => ({
    date: d.date ?? d.day ?? '',
    prescriptions: isNum(d.prescriptions) ? d.prescriptions : null,
    labels: isNum(d.labels) ? d.labels : null,
  }));
  const topProducts = (topProductsQuery.data ?? []).filter((p: ApiData) => p?.name && isNum(p.dispensed));
  const recentPrescriptions = (recentQuery.data ?? []).slice(0, 5);
  const lowStockItems = (lowStockQuery.data ?? []).slice(0, 4);

  const stock = inventory?.stock;
  const hasStockBreakdown = isNum(stock?.healthy) && isNum(stock?.low) && isNum(stock?.outOfStock);
  const stockTotal = hasStockBreakdown ? stock.healthy + stock.low + stock.outOfStock : 0;
  const donutData = hasStockBreakdown
    ? [
        { name: 'In Stock', value: stock.healthy, color: '#10B981' },
        { name: 'Low Stock', value: stock.low, color: '#F59E0B' },
        { name: 'Out of Stock', value: stock.outOfStock, color: '#EF4444' },
      ]
    : [];

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {/* 1. DASHBOARD HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/88 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-[#0F172A] leading-tight">Dashboard</h1>
          <p className="text-xs sm:text-[13px] font-medium text-[#64748B] mt-1">Pharmacy activity and stock overview.</p>
        </div>

        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 shadow-2xs">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center border border-blue-100">
            <Calendar className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-[#0F172A]" suppressHydrationWarning>
            {today}
          </span>
        </div>
      </div>

      <UnverifiedDataNotice />

      {/* 2. KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Patients Today"
          value={kpiValue(summaryQuery, summary?.today?.patientsServed)}
          subtext={summaryQuery.status === 'error' ? 'Could not load' : 'Patients served today'}
          subtextColor={summaryQuery.status === 'error' ? 'red' : 'slate'}
          icon={Users}
          variant="blue"
          href="/admin/patients"
        />
        <StatCard
          title="Labels Printed"
          value={kpiValue(summaryQuery, summary?.today?.labelsPrinted)}
          subtext={summaryQuery.status === 'error' ? 'Could not load' : 'Printed today'}
          subtextColor={summaryQuery.status === 'error' ? 'red' : 'slate'}
          icon={Printer}
          variant="green"
          href="/admin/labels"
        />
        <StatCard
          title="Total Products"
          value={kpiValue(inventoryQuery, inventory?.totalProducts)}
          subtext={inventoryQuery.status === 'error' ? 'Could not load' : 'Products in catalog'}
          subtextColor={inventoryQuery.status === 'error' ? 'red' : 'slate'}
          icon={Package}
          variant="purple"
          href="/admin/products"
        />
        <StatCard
          title="Low Stock Items"
          value={kpiValue(summaryQuery, summary?.inventory?.lowStock)}
          subtext={summaryQuery.status === 'error' ? 'Could not load' : 'At or below reorder level'}
          subtextColor={summaryQuery.status === 'error' ? 'red' : 'slate'}
          icon={TriangleAlert}
          variant="red"
          href="/admin/inventory/low-stock"
        />
      </div>
      {summaryQuery.status === 'error' && (
        <div className="bg-white rounded-2xl border border-slate-200">
          <ErrorState title="Could not load today's summary" message={summaryQuery.error} onRetry={summaryQuery.retry} compact />
        </div>
      )}

      {/* 3. QUICK ACTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        <QuickActionCard
          title="Create Prescription Labels"
          description="Search medicines, configure dosages, add patient instructions and print prescription labels."
          href="/label"
          ctaText="Open Label Workstation"
          gradient="linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #3B82F6 100%)"
          icon={FileText}
          graphicType="printer"
        />
        <QuickActionCard
          title="Manage Inventory"
          description="View stock levels, batches, suppliers and low-stock items."
          href="/admin/inventory"
          ctaText="Open Inventory"
          gradient="linear-gradient(135deg, #0284C7 0%, #06B6D4 50%, #0D9488 100%)"
          icon={Boxes}
          graphicType="inventory"
        />
        <QuickActionCard
          title="Patient Management"
          description="Search patient records, view prescription history and medical notes."
          href="/admin/patients"
          ctaText="Open Patients"
          gradient="linear-gradient(135deg, #3B82F6 0%, #4F46E5 50%, #6366F1 100%)"
          icon={Users}
          graphicType="patients"
        />
      </div>

      {/* 4. ACTIVITY CHART + STOCK DONUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-100 gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-sm font-bold text-[#0F172A]">Prescription & Label Activity</h3>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">Prescriptions recorded and labels printed</p>
            </div>
            <div className="inline-flex p-1 rounded-xl bg-slate-100/80 border border-slate-200/60 self-start sm:self-auto" role="tablist" aria-label="Activity range">
              {(['7d', '30d', '90d', '1y'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={activityRange === t}
                  onClick={() => setActivityRange(t)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    activityRange === t ? 'bg-white text-[#2563EB] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {activityQuery.status === 'loading' ? (
            <LoadingState label="Loading activity…" />
          ) : activityQuery.status === 'error' ? (
            <ErrorState title="Could not load activity" message={activityQuery.error} onRetry={activityQuery.retry} compact />
          ) : activityData.length === 0 ? (
            <p className="text-center text-slate-500 py-16 text-xs font-semibold">No activity recorded for this period.</p>
          ) : (
            <>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 mb-3 px-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#2563EB]" />
                  <span>Prescriptions</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#10B981] rounded-full" />
                  <span>Labels Printed</span>
                </div>
              </div>
              <div className="h-[330px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={activityData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ ...TOOLTIP_STYLE, borderRadius: '12px', fontSize: '12px' }} />
                    <Bar dataKey="prescriptions" name="Prescriptions" fill="#2563EB" radius={[5, 5, 0, 0]} maxBarSize={38} />
                    <Line
                      type="monotone"
                      dataKey="labels"
                      name="Labels Printed"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      dot={{ fill: '#10B981', r: 3.5, strokeWidth: 1.5, stroke: '#FFFFFF' }}
                      activeDot={{ r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>

        <div className="lg:col-span-4 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between pb-3.5 mb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-bold text-[#0F172A]">Stock Distribution</h3>
            </div>
            <Link href="/admin/inventory" className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 transition-colors">
              <span>View Inventory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {inventoryQuery.status === 'loading' ? (
            <LoadingState label="Loading stock…" />
          ) : inventoryQuery.status === 'error' ? (
            <ErrorState title="Could not load stock" message={inventoryQuery.error} onRetry={inventoryQuery.retry} compact />
          ) : !hasStockBreakdown || stockTotal === 0 ? (
            <p className="text-center text-slate-500 py-16 text-xs font-semibold">No stock data available.</p>
          ) : (
            <>
              <div className="relative w-full h-[180px] my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {donutData.map((entry, index) => (
                        <Cell key={`donut-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-extrabold text-[#0F172A] leading-tight">{stockTotal.toLocaleString()}</span>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Products</span>
                </div>
              </div>
              <div className="space-y-2 pt-1 border-t border-slate-100">
                {donutData.map((seg) => (
                  <div key={seg.name} className="flex items-center justify-between text-xs font-semibold p-1.5 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                      <span className="text-slate-700">{seg.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-900">{seg.value.toLocaleString()}</span>
                      <span className="text-slate-400 text-[11px] ml-1.5 font-medium">({Math.round((seg.value / stockTotal) * 100)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 5. TOP MEDICINES + RECENT ACTIVITY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-4 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
                <Package className="w-4 h-4 text-[#2563EB]" />
                <span>Top Dispensed Medicines</span>
              </h3>
              <p className="text-[11px] text-[#64748B]">Ranked by units dispensed</p>
            </div>
          </div>
          {topProductsQuery.status === 'loading' ? (
            <LoadingState label="Loading…" />
          ) : topProductsQuery.status === 'error' ? (
            <ErrorState title="Could not load top medicines" message={topProductsQuery.error} onRetry={topProductsQuery.retry} compact />
          ) : topProducts.length === 0 ? (
            <p className="text-center text-slate-500 py-12 text-xs font-semibold">No dispensing recorded for this period.</p>
          ) : (
            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={topProducts} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={115} tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(val: ApiData) => [`${val} units`, 'Dispensed']} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="dispensed" fill="#2563EB" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between pb-3.5 mb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-bold text-[#0F172A]">Recent Prescriptions</h3>
            </div>
            <Link href="/admin/prescriptions" className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 transition-colors">
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {recentQuery.status === 'loading' ? (
            <LoadingState label="Loading recent prescriptions…" />
          ) : recentQuery.status === 'error' ? (
            <ErrorState title="Could not load recent prescriptions" message={recentQuery.error} onRetry={recentQuery.retry} compact />
          ) : recentPrescriptions.length === 0 ? (
            <p className="text-center text-slate-500 py-10 text-xs font-semibold">No prescriptions recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 font-semibold border-b border-slate-100">
                    <th className="py-2.5 px-2">Patient</th>
                    <th className="py-2.5 px-2">Product</th>
                    <th className="py-2.5 px-2 text-center">Qty</th>
                    <th className="py-2.5 px-2">Time</th>
                    <th className="py-2.5 px-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70">
                  {recentPrescriptions.map((rx: ApiData, idx: number) => {
                    const patientName: string | undefined = rx.customer_name_text;
                    const firstItem = rx.prescription_items?.[0];
                    return (
                      <tr key={rx.id || idx} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-2.5 px-2 font-bold text-slate-800">
                          <span className="truncate max-w-[150px] inline-block align-bottom">{patientName || MISSING}</span>
                        </td>
                        <td className="py-2.5 px-2 font-medium text-slate-700 truncate max-w-[180px]">
                          {firstItem?.product_name || MISSING}
                          {rx.prescription_items?.length > 1 && (
                            <span className="text-slate-400"> +{rx.prescription_items.length - 1}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 font-mono font-bold text-slate-800 text-center">{firstItem?.quantity ?? MISSING}</td>
                        <td className="py-2.5 px-2 font-mono text-[11px] text-slate-500">
                          {rx.created_at
                            ? new Date(rx.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                            : MISSING}
                        </td>
                        <td className="py-2.5 px-2 text-right">{rx.status ? <StatusBadge status={rx.status} /> : MISSING}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 6. LOW STOCK + QUICK LINKS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-4 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>Low Stock</span>
            </span>
            <Link href="/admin/inventory/low-stock" className="text-[11px] font-bold text-[#2563EB] hover:underline">
              View All &rarr;
            </Link>
          </div>
          {lowStockQuery.status === 'loading' ? (
            <LoadingState label="Loading…" />
          ) : lowStockQuery.status === 'error' ? (
            <ErrorState title="Could not load low stock" message={lowStockQuery.error} onRetry={lowStockQuery.retry} compact />
          ) : lowStockItems.length === 0 ? (
            <p className="text-center text-slate-500 py-6 text-xs font-semibold">No products at or below reorder level.</p>
          ) : (
            <div className="space-y-1.5">
              {lowStockItems.map((item: ApiData, i: number) => {
                const remaining = item.stock_quantity ?? item.remaining;
                const row = (
                  <>
                    <span className="font-bold text-slate-800 truncate" title={item.name}>
                      {item.name || MISSING}
                    </span>
                    <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded text-[11px] shrink-0 border border-rose-100">
                      {isNum(remaining) ? `${remaining} left` : MISSING}
                    </span>
                  </>
                );
                return item.id ? (
                  <Link
                    key={item.id}
                    href={`/admin/products/${item.id}`}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-rose-50/50 transition-colors text-xs"
                  >
                    {row}
                  </Link>
                ) : (
                  <div key={i} className="flex items-center justify-between gap-2 p-2 text-xs">
                    {row}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-4 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
            <h3 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Reports</span>
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/admin/analytics', label: 'Analytics', icon: FileText, cls: 'bg-blue-50/70 hover:bg-blue-100/70 border-blue-100/80', iconCls: 'text-[#2563EB]' },
              { href: '/admin/inventory/analytics', label: 'Stock Analytics', icon: TrendingUp, cls: 'bg-emerald-50/70 hover:bg-emerald-100/70 border-emerald-100/80', iconCls: 'text-[#10B981]' },
              { href: '/admin/patients', label: 'Patients', icon: Users, cls: 'bg-indigo-50/70 hover:bg-indigo-100/70 border-indigo-100/80', iconCls: 'text-[#4F46E5]' },
              { href: '/admin/inventory/expiry', label: 'Expiry', icon: Calendar, cls: 'bg-amber-50/70 hover:bg-amber-100/70 border-amber-100/80', iconCls: 'text-[#F59E0B]' },
            ].map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className={`p-2 rounded-xl border transition-all flex flex-col items-center justify-center text-center ${r.cls}`}
              >
                <r.icon className={`w-4 h-4 mb-1 ${r.iconCls}`} />
                <span className="text-[11px] font-bold text-slate-800 leading-tight">{r.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
