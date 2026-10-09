'use client';

import React from 'react';

export type StatusType =
  | 'printed'
  | 'saved'
  | 'failed'
  | 'reprinted'
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'expiring'
  | 'completed'
  | 'draft'
  | 'cancelled'
  | 'operational'
  | 'connected'
  | 'quarantine';

interface StatusBadgeProps {
  status: string | StatusType;
  label?: string;
  className?: string;
}

export default function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const norm = (status || '').toLowerCase().replace(/[\s_-]+/g, '');

  let style = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';

  if (norm === 'printed' || norm === 'completed' || norm === 'instock' || norm === 'operational' || norm === 'connected') {
    style = 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
    dotColor = 'bg-[#10B981]';
  } else if (norm === 'saved' || norm === 'draft') {
    style = 'bg-blue-50 text-blue-700 border-blue-200/80';
    dotColor = 'bg-[#2563EB]';
  } else if (norm === 'reprinted' || norm === 'lowstock' || norm === 'warning') {
    style = 'bg-amber-50 text-amber-700 border-amber-200/80';
    dotColor = 'bg-[#F59E0B]';
  } else if (norm === 'failed' || norm === 'outofstock' || norm === 'cancelled' || norm === 'quarantine' || norm === 'expired') {
    style = 'bg-rose-50 text-rose-700 border-rose-200/80';
    dotColor = 'bg-[#EF4444]';
  } else if (norm === 'expiring' || norm === 'expiringsoon') {
    style = 'bg-purple-50 text-purple-700 border-purple-200/80';
    dotColor = 'bg-purple-500';
  }

  const displayLabel = label || status;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border capitalize leading-none select-none ${style} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{displayLabel}</span>
    </span>
  );
}
