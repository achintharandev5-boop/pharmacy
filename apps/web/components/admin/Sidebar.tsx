'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FilePlus2,
  Users,
  FileText,
  Package,
  Boxes,
  Truck,
  History,
  TrendingUp,
  Settings,
} from 'lucide-react';

interface SidebarProps {
  onNavigate?: () => void;
}

interface NavSection {
  title: string;
  items: {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    exact?: boolean;
  }[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'WORKSPACE',
    items: [
      { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true },
      { label: 'Label Create', href: '/label', icon: FilePlus2, exact: false },
    ],
  },
  {
    title: 'MANAGEMENT',
    items: [
      { label: 'Patients', href: '/admin/patients', icon: Users, exact: false },
      { label: 'Prescriptions', href: '/admin/prescriptions', icon: FileText, exact: false },
      { label: 'Products', href: '/admin/products', icon: Package, exact: false },
      { label: 'Inventory', href: '/admin/inventory', icon: Boxes, exact: false },
      { label: 'Suppliers', href: '/admin/inventory/suppliers', icon: Truck, exact: false },
    ],
  },
  {
    title: 'INSIGHTS',
    items: [
      { label: 'Analytics', href: '/admin/analytics', icon: TrendingUp, exact: false },
      { label: 'Label History', href: '/admin/labels', icon: History, exact: false },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { label: 'Settings', href: '/admin/settings', icon: Settings, exact: false },
    ],
  },
];

export default function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();

  const isItemActive = (href: string, exact?: boolean) => {
    const basePath = href.split('?')[0];
    if (exact) {
      return pathname === basePath;
    }
    if (basePath === '/admin') {
      return pathname === '/admin';
    }
    return pathname === basePath || pathname.startsWith(basePath + '/');
  };

  return (
    <div className="w-full h-full flex flex-col justify-between p-3.5 select-none font-sans overflow-hidden">
      {/* Brand Header */}
      <div className="shrink-0 pb-1">
        <Link
          href="/admin"
          onClick={onNavigate}
          className="flex items-center gap-3 px-2 py-1.5 group transition-transform duration-150 active:scale-[0.98]"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(37,99,235,0.28)] shrink-0">
            {/* Custom stylized Rx symbol */}
            <span className="font-extrabold text-[17px] tracking-tight leading-none italic font-serif">℞</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-[#0F172A] tracking-tight leading-snug truncate">
              Pharmacy System
            </h1>
            <p className="text-[10.5px] font-medium text-[#64748B] truncate leading-tight">
              Prescription Labels & Inventory
            </p>
          </div>
        </Link>
      </div>

      {/* Grouped Navigation Sections (Scrollable if screen height is compact) */}
      <div className="flex-1 overflow-y-auto space-y-3.5 py-1 pr-0.5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-3 pb-0.5 text-[10px] font-bold text-[#94A3B8] tracking-widest uppercase">
              {section.title}
            </div>
            <nav className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.href, item.exact);

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] font-semibold transition-all duration-150 h-[38px] ${
                      active
                        ? 'bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white shadow-[0_4px_12px_rgba(37,99,235,0.18)]'
                        : 'text-[#475569] hover:bg-[#EFF6FF] hover:text-[#1D4ED8]'
                    }`}
                  >
                    <Icon
                      className={`w-[17px] h-[17px] shrink-0 ${
                        active ? 'text-white' : 'text-[#64748B]'
                      }`}
                      strokeWidth={active ? 2.3 : 1.9}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

    </div>
  );
}
