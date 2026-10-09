'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Bell,
  Menu,
  ChevronDown,
  User,
  Settings,
  LogOut,
  X,
  CheckCircle2,
} from 'lucide-react';
import { handleLogout } from '@/app/actions/auth';

interface TopHeaderProps {
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

export default function TopHeader({ onToggleSidebar, sidebarOpen }: TopHeaderProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Ctrl+K keyboard shortcut to focus global search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.trim().toLowerCase();

    if (/^\d{8,}$/.test(q) || q.startsWith('94') || q.startsWith('07')) {
      router.push(`/admin/patients?search=${encodeURIComponent(q)}`);
    } else if (q.startsWith('rx-') || q.startsWith('rx')) {
      router.push(`/admin/prescriptions?search=${encodeURIComponent(q)}`);
    } else {
      router.push(`/admin/products?search=${encodeURIComponent(q)}`);
    }
  };

  return (
    <header className="h-[70px] bg-white/78 backdrop-blur-md border-b border-slate-200/70 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-40 shadow-[0_2px_12px_rgba(15,23,42,0.03)] select-none">
      {/* Left: Mobile Toggle / Menu */}
      <div className="flex items-center gap-3 lg:hidden">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-[#EFF6FF] border border-transparent hover:border-blue-100 transition-colors"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Center: Global Search */}
      <form onSubmit={handleGlobalSearch} className="flex-1 max-w-2xl mx-4 sm:mx-6">
        <div className="relative flex items-center group">
          <Search className="w-4 h-4 absolute left-3.5 text-slate-400 group-focus-within:text-[#2563EB] transition-colors pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patient, phone, prescription, product or barcode..."
            className="w-full h-[42px] pl-10 pr-16 bg-[#F8FBFF] hover:bg-white focus:bg-white border border-slate-200 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 rounded-xl text-[13px] font-medium text-[#0F172A] outline-none transition-all placeholder:text-slate-400 shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)]"
          />
          <div className="absolute right-2.5 flex items-center gap-1 pointer-events-none">
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-500 bg-white border border-slate-200 rounded-md shadow-xs">
              Ctrl K
            </kbd>
          </div>
        </div>
      </form>

      {/* Right: Notification & User Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-[#EFF6FF] rounded-xl relative transition-colors border border-transparent hover:border-blue-100"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-[#EF4444] rounded-full ring-2 ring-white" />
          </button>

          {/* Notifications Dropdown */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200/80 shadow-[0_12px_36px_rgba(15,23,42,0.12)] p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-[#0F172A]">Notifications</span>
                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  1 Unread
                </span>
              </div>
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100/70 text-xs">
                  <div className="flex items-center gap-2 text-blue-800 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Inventory Low Stock Alert</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 pl-5">
                    Amoxicillin 500mg has 2 units remaining. Reorder suggested.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2.5 p-1 sm:px-2 sm:py-1.5 rounded-xl hover:bg-slate-100/70 border border-transparent hover:border-slate-200/60 transition-all text-left"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563EB] to-[#4F46E5] text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0 ring-2 ring-blue-100">
              AD
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-xs font-bold text-[#0F172A] leading-tight">Sisila Chemist</span>
              <span className="text-[11px] font-medium text-[#64748B] leading-tight mt-0.5">
                Pharmacist / Admin
              </span>
            </div>
            <ChevronDown className="hidden md:block w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {/* User Profile Dropdown */}
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200/80 shadow-[0_12px_36px_rgba(15,23,42,0.12)] p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                <p className="text-xs font-bold text-[#0F172A]">Sisila Chemist</p>
                <p className="text-[11px] text-[#64748B]">admin@sisilapharmacy.lk</p>
              </div>

              <Link
                href="/admin/settings"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-[#EFF6FF] hover:text-[#1D4ED8] transition-colors"
              >
                <User className="w-4 h-4 text-slate-400" />
                <span>My Profile</span>
              </Link>

              <Link
                href="/admin/settings"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-[#EFF6FF] hover:text-[#1D4ED8] transition-colors"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                <span>System Settings</span>
              </Link>

              <div className="h-px bg-slate-100 my-1" />

              <form action={handleLogout}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  <span>Sign Out</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
