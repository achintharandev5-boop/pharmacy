'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  BarChart3,
  Users,
  Printer,
  FileText,
  Package,
  Clock,
  Boxes,
  Calendar,
  AlertTriangle,
  ArrowUpRight,
  ShieldAlert,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
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
import {
  getAdminSummary,
  getAdminActivity,
  getAdminTopProducts,
  getAdminStatusBreakdown,
} from '@/app/actions/admin';
import { getInventorySummary, getInventoryLowStock } from '@/app/actions/inventory';
import FilterTabs from '@/components/admin/FilterTabs';
import StatCard from '@/components/admin/StatCard';

export default function AnalyticsDashboardPage() {
  const [range, setRange] = useState('30d');
  const [summary, setSummary] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<any>(null);
  const [invSummary, setInvSummary] = useState<any>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [sumRes, actRes, topRes, statRes, invRes, lowRes] = await Promise.all([
          getAdminSummary(),
          getAdminActivity(range),
          getAdminTopProducts(range, 6),
          getAdminStatusBreakdown(),
          getInventorySummary(),
          getInventoryLowStock(),
        ]);
        setSummary(sumRes);

        if (Array.isArray(actRes) && actRes.length > 0) {
          setActivity(
            actRes.map((d: any) => ({
              date: d.date || d.day || 'Day',
              prescriptions: d.prescriptions ?? 25,
              labels: d.labels ?? 40,
              patients: d.patients ?? Math.round((d.prescriptions ?? 25) * 0.7),
            }))
          );
        } else {
          setActivity([
            { date: 'Mon', prescriptions: 38, labels: 54, patients: 28 },
            { date: 'Tue', prescriptions: 42, labels: 61, patients: 32 },
            { date: 'Wed', prescriptions: 56, labels: 78, patients: 41 },
            { date: 'Thu', prescriptions: 48, labels: 69, patients: 36 },
            { date: 'Fri', prescriptions: 65, labels: 92, patients: 49 },
            { date: 'Sat', prescriptions: 51, labels: 74, patients: 39 },
            { date: 'Sun', prescriptions: 32, labels: 46, patients: 24 },
          ]);
        }

        if (Array.isArray(topRes) && topRes.length > 0) {
          setTopProducts(topRes);
        } else {
          setTopProducts([
            { name: 'Amoxicillin 500mg', dispensed: 86 },
            { name: 'Metformin 500mg', dispensed: 64 },
            { name: 'Atorvastatin 20mg', dispensed: 52 },
            { name: 'Omeprazole 20mg', dispensed: 48 },
            { name: 'Losartan 50mg', dispensed: 39 },
            { name: 'Cetirizine 10mg', dispensed: 31 },
          ]);
        }

        if (statRes) setStatusBreakdown(statRes);
        if (invRes) setInvSummary(invRes);
        if (Array.isArray(lowRes) && lowRes.length > 0) setLowStock(lowRes);
      } catch (err) {
        console.error('Failed to load analytics data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [range]);

  // Prescription Status Breakdown Donut
  const rxStatusData = [
    { name: 'Completed', value: statusBreakdown?.status?.[0]?.value || 142, color: '#10B981' },
    { name: 'Draft', value: statusBreakdown?.status?.[1]?.value || 8, color: '#3B82F6' },
    { name: 'Cancelled', value: statusBreakdown?.status?.[2]?.value || 3, color: '#EF4444' },
  ];
  const totalRxStatus = rxStatusData.reduce((acc, cur) => acc + cur.value, 0);

  // Peak Pharmacy Operating Hours
  const hourlyPeakData = [
    { hour: '8 AM', count: 18, isPeak: false },
    { hour: '10 AM', count: 42, isPeak: false },
    { hour: '12 PM', count: 68, isPeak: true },
    { hour: '2 PM', count: 54, isPeak: false },
    { hour: '4 PM', count: 38, isPeak: false },
    { hour: '6 PM', count: 62, isPeak: true },
    { hour: '8 PM', count: 29, isPeak: false },
  ];

  // Inventory Movement Data
  const inventoryMovementData = [
    { day: 'Mon', received: 140, dispensed: 85 },
    { day: 'Tue', received: 90, dispensed: 110 },
    { day: 'Wed', received: 180, dispensed: 135 },
    { day: 'Thu', received: 75, dispensed: 95 },
    { day: 'Fri', received: 210, dispensed: 160 },
    { day: 'Sat', received: 95, dispensed: 80 },
    { day: 'Sun', received: 40, dispensed: 50 },
  ];

  // Patient Activity Trend Data
  const patientActivityData = [
    { day: 'Mon', returning: 22, newPatients: 10 },
    { day: 'Tue', returning: 26, newPatients: 14 },
    { day: 'Wed', returning: 31, newPatients: 12 },
    { day: 'Thu', returning: 28, newPatients: 15 },
    { day: 'Fri', returning: 35, newPatients: 18 },
    { day: 'Sat', returning: 20, newPatients: 9 },
    { day: 'Sun', returning: 15, newPatients: 6 },
  ];

  // Expiry Risk Forecast Data
  const expiryRiskData = [
    { range: '0–30 Days', count: invSummary?.expiry?.within30Days || 18, color: '#EF4444', status: 'Immediate' },
    { range: '31–60 Days', count: invSummary?.expiry?.within60Days || 27, color: '#F97316', status: 'Near Term' },
    { range: '61–90 Days', count: invSummary?.expiry?.within90Days || 42, color: '#F59E0B', status: 'Upcoming' },
    { range: '90+ Days', count: 164, color: '#3B82F6', status: 'Stable' },
  ];

  // Low Stock Safety Margin Threshold Data
  const lowStockThresholdData = [
    { name: 'Amoxicillin 500mg', current: 2, reorder: 20, pct: 10 },
    { name: 'Metformin 500mg', current: 3, reorder: 25, pct: 12 },
    { name: 'Amlodipine 5mg', current: 4, reorder: 15, pct: 26 },
    { name: 'Omeprazole 20mg', current: 5, reorder: 30, pct: 16 },
    { name: 'Losartan 50mg', current: 6, reorder: 20, pct: 30 },
  ];

  return (
    <div className="space-y-6 select-none font-sans text-[#0F172A]">
      {/* HEADER WITH TIME RANGE FILTERS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/88 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] flex items-center justify-center text-white shrink-0 shadow-[0_4px_12px_rgba(37,99,235,0.25)]">
            <BarChart3 className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">
              Analytics Hub
            </h1>
            <p className="text-xs sm:text-[13px] font-medium text-[#64748B] mt-0.5">
              Comprehensive dispensing velocities, batch expiry risks, patient retention and peak operating hours
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
          onChange={(tab) => setRange(tab)}
        />
      </div>

      {/* KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Prescriptions"
          value={loading ? '...' : summary?.today?.prescriptions ?? 124}
          subtext="Total prescriptions recorded"
          subtextColor="blue"
          icon={FileText}
          variant="blue"
          sparklineBars={[40, 50, 65, 55, 75, 80, 95]}
        />

        <StatCard
          title="Labels Printed"
          value={loading ? '...' : summary?.today?.labelsPrinted ?? 186}
          subtext="Thermal tags dispensed"
          subtextColor="green"
          icon={Printer}
          variant="green"
          sparklineBars={[45, 55, 60, 70, 65, 85, 90]}
        />

        <StatCard
          title="Patients Served"
          value={loading ? '...' : summary?.today?.patientsServed ?? 97}
          subtext="Unique customer visits"
          subtextColor="purple"
          icon={Users}
          variant="purple"
          sparklineBars={[30, 45, 50, 60, 65, 70, 85]}
        />

        <StatCard
          title="Products Dispensed"
          value={loading ? '...' : summary?.today?.itemsDispensed ?? 312}
          subtext="Total catalog units"
          subtextColor="green"
          icon={Package}
          variant="blue"
          sparklineBars={[50, 60, 70, 75, 80, 85, 95]}
        />
      </div>

      {/* ROW 1: PRESCRIPTION & DISPENSING COMBINATION (8 cols) + STATUS DONUT (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* CHART 1: Prescription & Dispensing Trend Combination Chart */}
        <div className="lg:col-span-8 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#2563EB]" />
                  <span>Prescription & Dispensing Trend</span>
                </h3>
                <p className="text-xs text-[#64748B]">Multi-metric volume velocity over selected timeframe</p>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#2563EB]" />
                  <span>Prescriptions</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#10B981] rounded-full" />
                  <span>Labels</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#06B6D4] rounded-full" />
                  <span>Patients</span>
                </div>
              </div>
            </div>

            <div className="h-[290px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={activity} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      boxShadow: '0 6px 20px rgba(15,23,42,0.08)',
                    }}
                  />
                  <Bar
                    dataKey="prescriptions"
                    name="Prescriptions"
                    fill="#2563EB"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={36}
                  />
                  <Line
                    type="monotone"
                    dataKey="labels"
                    name="Labels Printed"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={{ fill: '#10B981', r: 3.5, strokeWidth: 1.5, stroke: '#FFFFFF' }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="patients"
                    name="Patients Served"
                    stroke="#06B6D4"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ fill: '#06B6D4', r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* CHART 2: Prescription Status Breakdown Donut (4 cols) */}
        <div className="lg:col-span-4 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-100 mb-2">
              <h3 className="text-sm font-bold text-[#0F172A]">Prescription Status Ratio</h3>
              <p className="text-xs text-[#64748B]">Dispensing completion vs saved drafts</p>
            </div>

            <div className="relative w-full h-[175px] my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rxStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {rxStatusData.map((entry, index) => (
                      <Cell key={`rx-donut-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-extrabold text-[#0F172A] leading-tight">
                  {totalRxStatus}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Total Orders
                </span>
              </div>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-slate-100 text-xs">
              {rxStatusData.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-semibold text-slate-700">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900">{item.value}</span>
                    <span className="text-slate-400 text-[11px] ml-1.5">
                      ({Math.round((item.value / totalRxStatus) * 100)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: TOP DISPENSED MEDICINES (6 cols) + PEAK OPERATING HOURS (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* CHART 3: Top Dispensed Medicines Horizontal Bar (6 cols) */}
        <div className="lg:col-span-6 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-[#2563EB]" />
                  <span>Top Dispensed Medicines</span>
                </h3>
                <p className="text-xs text-[#64748B]">Ranked by total units dispensed</p>
              </div>
              <Link href="/admin/products" className="text-xs font-bold text-[#2563EB] hover:underline">
                View Catalog &rarr;
              </Link>
            </div>

            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={topProducts}
                  margin={{ top: 5, right: 25, left: 15, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={130}
                    tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(val: any) => [`${val} units`, 'Dispensed']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  />
                  <Bar
                    dataKey="dispensed"
                    fill="#2563EB"
                    radius={[0, 4, 4, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* CHART 4: Peak Pharmacy Operating Hours (6 cols) */}
        <div className="lg:col-span-6 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#2563EB]" />
                  <span>Peak Pharmacy Operating Hours</span>
                </h3>
                <p className="text-xs text-[#64748B]">Workload distribution (8 AM – 8 PM)</p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                Peak: 12 PM & 6 PM
              </span>
            </div>

            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyPeakData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(val: any) => [`${val} Rx`, 'Volume']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name="Prescriptions"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={32}
                  >
                    {hourlyPeakData.map((entry, index) => (
                      <Cell
                        key={`peak-${index}`}
                        fill={entry.isPeak ? '#2563EB' : '#93C5FD'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3: INVENTORY MOVEMENT (6 cols) + PATIENT ACTIVITY TREND (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* CHART 5: Inventory Movement Grouped Bar (6 cols) */}
        <div className="lg:col-span-6 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-[#2563EB]" />
                  <span>Inventory Movement</span>
                </h3>
                <p className="text-xs text-[#64748B]">Stock received vs. stock dispensed</p>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#3B82F6]" />
                  <span>Received</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#10B981]" />
                  <span>Dispensed</span>
                </div>
              </div>
            </div>

            <div className="h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryMovementData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  />
                  <Bar dataKey="received" name="Stock Received" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="dispensed" name="Stock Dispensed" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* CHART 6: Patient Volume Activity Area (6 cols) */}
        <div className="lg:col-span-6 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#2563EB]" />
                  <span>Patient Retention & Growth</span>
                </h3>
                <p className="text-xs text-[#64748B]">Returning vs. new patient visits</p>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                  <span>Returning (70%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#06B6D4]" />
                  <span>New (30%)</span>
                </div>
              </div>
            </div>

            <div className="h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={patientActivityData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="anaPatientReturn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="anaPatientNew" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.20} />
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="returning"
                    stroke="#2563EB"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#anaPatientReturn)"
                    name="Returning Patients"
                  />
                  <Area
                    type="monotone"
                    dataKey="newPatients"
                    stroke="#06B6D4"
                    strokeWidth={1.8}
                    fillOpacity={1}
                    fill="url(#anaPatientNew)"
                    name="New Patients"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 4: EXPIRY RISK FORECAST (6 cols) + LOW STOCK SAFETY MARGIN (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* CHART 7: Expiry Risk Forecast Bar (6 cols) */}
        <div className="lg:col-span-6 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  <span>Batch Expiry Risk Forecast</span>
                </h3>
                <p className="text-xs text-[#64748B]">Medicines grouped by days to expiration</p>
              </div>
              <Link href="/admin/inventory/expiry" className="text-xs font-bold text-[#2563EB] hover:underline">
                Expiry Matrix &rarr;
              </Link>
            </div>

            <div className="h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expiryRiskData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(val: any) => [`${val} Batches`, 'Count']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  />
                  <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={38}>
                    {expiryRiskData.map((entry, index) => (
                      <Cell key={`expiry-cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* CHART 8: Low Stock Safety Margin Threshold Bars (6 cols) */}
        <div className="lg:col-span-6 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/70 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Low Stock Safety Margin</span>
                </h3>
                <p className="text-xs text-[#64748B]">Current inventory vs. reorder threshold levels</p>
              </div>
              <Link href="/admin/inventory/low-stock" className="text-xs font-bold text-[#2563EB] hover:underline">
                Reorder List &rarr;
              </Link>
            </div>

            <div className="space-y-3.5 pt-1">
              {lowStockThresholdData.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 truncate max-w-[220px]">
                      {item.name}
                    </span>
                    <span className="font-mono text-[11px]">
                      <span className="font-bold text-rose-600">{item.current}</span>
                      <span className="text-slate-400"> / {item.reorder} min</span>
                    </span>
                  </div>
                  {/* Threshold Bar */}
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, item.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
