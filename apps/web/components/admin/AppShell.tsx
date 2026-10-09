'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen font-sans antialiased text-[#0F172A] bg-[#F5F9FF] relative selection:bg-blue-100 selection:text-blue-900">
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

      {/* DESKTOP FIXED FULL-HEIGHT SIDEBAR */}
      <aside className="hidden lg:flex fixed top-0 bottom-0 left-0 w-[240px] h-screen z-30 bg-white/80 backdrop-blur-xl border-r border-slate-200/70 flex-col overflow-hidden shadow-[2px_0_12px_rgba(15,23,42,0.02)]">
        <Sidebar />
      </aside>

      {/* MOBILE DRAWER SIDEBAR */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative w-[260px] bg-white h-full z-10 shadow-2xl flex flex-col overflow-hidden">
            <Sidebar onNavigate={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* RIGHT SIDE MAIN WRAPPER (Offset by 240px on Desktop) */}
      <div className="relative z-10 flex flex-col min-h-screen lg:pl-[240px]">
        {/* TOP HEADER (Sticky at the top of content) */}
        <TopHeader
          onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          sidebarOpen={mobileSidebarOpen}
        />

        {/* MAIN PAGE CONTENT */}
        <main className="flex-1 p-4 sm:p-6 lg:p-7 space-y-6">
          <div className="max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
