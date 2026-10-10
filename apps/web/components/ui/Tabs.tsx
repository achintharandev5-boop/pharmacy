'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from './cn';

/** Section navigation rendered as tabs (each tab is a page). */
export function TabNav({ tabs, label }: { tabs: { href: string; label: string; exact?: boolean }[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-4 sm:mx-0 overflow-x-auto border-b border-border">
      <ul className="flex min-w-max gap-1 px-4 sm:px-0">
        {tabs.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium transition-colors',
                  active ? 'border-primary text-primary' : 'border-transparent text-subtle hover:text-fg hover:border-border-strong',
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export interface SegmentOption {
  id: string;
  label: string;
  count?: number | null;
}

/** A single-choice filter (for example status). */
export function SegmentedControl({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: SegmentOption[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex flex-wrap gap-1 rounded-ui bg-surface-2 p-1', className)}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-ui-sm px-3 text-sm font-medium transition-colors',
              active ? 'bg-page text-fg shadow-card' : 'text-subtle hover:text-fg',
            )}
          >
            {o.label}
            {typeof o.count === 'number' && (
              <span className={cn('tabular rounded-ui-sm px-1.5 text-xs', active ? 'bg-primary-soft text-primary' : 'bg-page text-subtle')}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
