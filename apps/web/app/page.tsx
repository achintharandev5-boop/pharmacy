import React from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  FilePlus2,
  Boxes,
  ArrowRight,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { handleLogout } from './actions/auth';

export default async function DashboardPortalPage() {
  return (
    <div className="min-h-screen bg-[#F5F9FF] flex flex-col font-sans antialiased text-[#0F172A] relative selection:bg-blue-100 selection:text-blue-900">
      {/* Background Soft Radial Gradient Layer */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.08) 0%, transparent 40%),
            linear-gradient(180deg, #F8FBFF 0%, #F3F8FF 100%)
          `,
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-[70px] bg-white/78 backdrop-blur-md border-b border-slate-200/70 px-6 flex items-center justify-between sticky top-0 z-40 shadow-[0_2px_12px_rgba(15,23,42,0.03)] select-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white flex items-center justify-center shadow-[0_4px_14px_rgba(37,99,235,0.30)] shrink-0">
              <span className="font-extrabold text-[17px] tracking-tight leading-none italic font-serif">℞</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#0F172A] tracking-tight">Pharmacy System</h1>
              <p className="text-[11px] font-medium text-[#64748B]">Prescription Labels & Inventory</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <form action={handleLogout}>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200/70 transition-colors"
              >
                Sign Out
              </button>
            </form>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-14 flex flex-col justify-center select-none">
          <div className="text-center max-w-xl mx-auto mb-12 space-y-2">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
              Pharmacy Control Portal
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] font-medium">
              Select an operational workstation to begin dispensing, reviewing telemetry, or auditing inventory.
            </p>
          </div>

          {/* 3 Portal Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Admin Command Center */}
            <Link
              href="/admin"
              className="bg-white/90 backdrop-blur-md rounded-2xl p-7 border border-slate-200/80 hover:border-blue-300 shadow-[0_4px_20px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_36px_rgba(37,99,235,0.12)] transition-all duration-200 flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center border border-blue-100 shadow-2xs group-hover:scale-105 transition-transform">
                  <LayoutDashboard className="w-7 h-7" strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">
                    Admin Dashboard
                  </h3>
                  <p className="text-xs text-[#64748B] leading-relaxed mt-1.5">
                    Executive KPI metrics, dispensing analytics, audit feeds, patient directories, and system health status.
                  </p>
                </div>
              </div>
              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#2563EB]">
                <span>Launch Dashboard</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Card 2: Label Workstation */}
            <Link
              href="/label"
              className="bg-white/90 backdrop-blur-md rounded-2xl p-7 border border-slate-200/80 hover:border-blue-300 shadow-[0_4px_20px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_36px_rgba(37,99,235,0.12)] transition-all duration-200 flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#10B981] flex items-center justify-center border border-emerald-100 shadow-2xs group-hover:scale-105 transition-transform">
                  <FilePlus2 className="w-7 h-7" strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">
                    Label Workstation
                  </h3>
                  <p className="text-xs text-[#64748B] leading-relaxed mt-1.5">
                    Fast POS dispensing, Sinhala dosage translation, meal timing matrix, and 8cm x 8cm thermal printing.
                  </p>
                </div>
              </div>
              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#2563EB]">
                <span>Open Workstation</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Card 3: Inventory */}
            <Link
              href="/admin/inventory"
              className="bg-white/90 backdrop-blur-md rounded-2xl p-7 border border-slate-200/80 hover:border-blue-300 shadow-[0_4px_20px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_36px_rgba(37,99,235,0.12)] transition-all duration-200 flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center border border-indigo-100 shadow-2xs group-hover:scale-105 transition-transform">
                  <Boxes className="w-7 h-7" strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">
                    Inventory & FEFO
                  </h3>
                  <p className="text-xs text-[#64748B] leading-relaxed mt-1.5">
                    Batch expiration queues, low stock alerts, stock receiving (GRN), supplier management, and valuations.
                  </p>
                </div>
              </div>
              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#2563EB]">
                <span>Manage Inventory</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-6 text-center text-xs font-medium text-[#64748B] select-none">
          © {new Date().getFullYear()} Sisila Chemist. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
