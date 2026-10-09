'use client';

import React from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface ActionItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary' | 'danger';
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  badge?: string;
  actions?: ActionItem[];
  children?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  badge,
  actions = [],
  children,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/88 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_rgba(15,23,42,0.03)] select-none">
      <div className="flex items-start sm:items-center gap-3.5">
        {Icon && (
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shrink-0 shadow-xs">
            <Icon className="w-5 h-5" strokeWidth={2.2} />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">
              {title}
            </h1>
            {badge && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#1D4ED8] border border-blue-200/80">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs sm:text-[13px] font-medium text-[#64748B] mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {(actions.length > 0 || children) && (
        <div className="flex items-center gap-2.5 flex-wrap">
          {actions.map((act, idx) => {
            const ActionIcon = act.icon;
            const isPrimary = !act.variant || act.variant === 'primary';
            const isDanger = act.variant === 'danger';

            const className = `inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-xs font-bold transition-all duration-150 shadow-xs ${
              isPrimary
                ? 'bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white hover:brightness-105 active:scale-[0.98]'
                : isDanger
                ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
            }`;

            if (act.href) {
              return (
                <Link key={idx} href={act.href} className={className}>
                  {ActionIcon && <ActionIcon className="w-4 h-4" />}
                  <span>{act.label}</span>
                </Link>
              );
            }

            return (
              <button key={idx} type="button" onClick={act.onClick} className={className}>
                {ActionIcon && <ActionIcon className="w-4 h-4" />}
                <span>{act.label}</span>
              </button>
            );
          })}
          {children}
        </div>
      )}
    </div>
  );
}
