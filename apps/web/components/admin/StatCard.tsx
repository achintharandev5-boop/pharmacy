'use client';

import React from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtext: string;
  subtextColor?: 'green' | 'red' | 'slate' | 'blue' | 'purple';
  icon: LucideIcon;
  variant?: 'blue' | 'green' | 'purple' | 'red';
  href?: string;
  sparklineBars?: number[]; // Values 0 to 100 for mini vertical bars
}

const VARIANT_STYLES = {
  blue: {
    iconBg: 'bg-blue-50 text-[#2563EB] border-blue-100',
    barColor: 'bg-blue-400',
    hoverBorder: 'hover:border-blue-300',
  },
  green: {
    iconBg: 'bg-emerald-50 text-[#10B981] border-emerald-100',
    barColor: 'bg-emerald-400',
    hoverBorder: 'hover:border-emerald-300',
  },
  purple: {
    iconBg: 'bg-indigo-50 text-[#4F46E5] border-indigo-100',
    barColor: 'bg-indigo-400',
    hoverBorder: 'hover:border-indigo-300',
  },
  red: {
    iconBg: 'bg-rose-50 text-[#EF4444] border-rose-100',
    barColor: 'bg-rose-400',
    hoverBorder: 'hover:border-rose-300',
  },
};

export default function StatCard({
  title,
  value,
  subtext,
  subtextColor = 'green',
  icon: Icon,
  variant = 'blue',
  href,
  sparklineBars = [30, 45, 60, 40, 75, 50, 85],
}: StatCardProps) {
  const styles = VARIANT_STYLES[variant];

  const subtextClass =
    subtextColor === 'green'
      ? 'text-[#10B981]'
      : subtextColor === 'red'
      ? 'text-[#EF4444]'
      : subtextColor === 'blue'
      ? 'text-[#2563EB]'
      : subtextColor === 'purple'
      ? 'text-[#4F46E5]'
      : 'text-[#64748B]';

  return (
    <div
      className={`bg-white/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col justify-between transition-all duration-150 ${styles.hoverBorder} group select-none`}
    >
      {/* Top Header: Icon & Title */}
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center border ${styles.iconBg} shadow-2xs shrink-0`}
        >
          <Icon className="w-5 h-5" strokeWidth={2.2} />
        </div>
        <span className="text-[13px] font-semibold text-[#64748B] truncate leading-tight">
          {title}
        </span>
      </div>

      {/* Middle Row: Big KPI Value & Sparkline Bars */}
      <div className="flex items-baseline justify-between mt-3 mb-2">
        <span className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
          {value}
        </span>

        {/* Mini Sparkline Bar Chart */}
        <div className="flex items-end gap-1 h-7">
          {sparklineBars.map((height, i) => (
            <div
              key={i}
              className={`w-1 rounded-full ${styles.barColor} transition-all duration-300`}
              style={{
                height: `${Math.max(15, Math.min(100, height))}%`,
                opacity: 0.35 + (i / sparklineBars.length) * 0.65,
              }}
            />
          ))}
        </div>
      </div>

      {/* Bottom Row: Trend / Subtext & Optional View Link */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100/80 text-xs">
        <span className={`font-semibold text-[11px] sm:text-xs truncate ${subtextClass}`}>
          {subtext}
        </span>

        {href && (
          <Link
            href={href}
            className="text-[11px] font-bold text-[#2563EB] hover:text-[#1D4ED8] hover:underline shrink-0"
          >
            View
          </Link>
        )}
      </div>
    </div>
  );
}
