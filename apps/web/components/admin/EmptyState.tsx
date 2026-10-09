'use client';

import React from 'react';
import Link from 'next/link';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionText?: string;
  actionHref?: string;
  onAction?: () => void;
}

export default function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  actionText,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-3 select-none">
      <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
        <Icon className="w-6 h-6" strokeWidth={1.8} />
      </div>
      <h3 className="text-sm font-bold text-[#0F172A]">{title}</h3>
      <p className="text-xs text-[#64748B] max-w-sm font-medium">{description}</p>
      {actionText && (
        <div className="pt-2">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white rounded-xl text-xs font-bold shadow-xs hover:brightness-105 transition-all"
            >
              {actionText}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white rounded-xl text-xs font-bold shadow-xs hover:brightness-105 transition-all"
            >
              {actionText}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
