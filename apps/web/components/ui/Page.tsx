'use client';

import { uiTestEnabled } from '@/lib/uiTestMode';
import React from 'react';
import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { Skeleton, MISSING } from './States';

export interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <header className="space-y-2">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-[13px] text-subtle">
            {breadcrumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} aria-hidden="true" />}
                {c.href ? (
                  <Link href={c.href} className="hover:text-primary hover:underline underline-offset-2">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-muted">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-fg sm:text-[28px]">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-subtle">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Standard vertical rhythm for a page. */
export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-6', className)}>{children}</div>;
}

interface StatTileProps {
  label: string;
  /** null/undefined renders "—" (unknown), never zero. */
  value: number | string | null | undefined;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
  href?: string;
  loading?: boolean;
  /** Error message: the value could not be loaded. */
  error?: string | null;
}

/** A single figure. Shows a skeleton while loading and "—" with the reason when unavailable. */
export function StatTile({ label, value, hint, icon: Icon, tone = 'neutral', href, loading, error }: StatTileProps) {
  const toneText = { neutral: 'text-fg', warning: 'text-warning', danger: 'text-danger', success: 'text-success' }[tone];
  const toneChip = {
    neutral: 'bg-[var(--color-tint)] text-primary',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    success: 'bg-success-soft text-success',
  }[tone];
  const display =
    value === null || value === undefined || (typeof value === 'number' && !Number.isFinite(value))
      ? MISSING
      : typeof value === 'number'
        ? value.toLocaleString()
        : value;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="pt-0.5 text-[13px] font-medium leading-snug text-subtle">{label}</span>
        {Icon && (
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-ui', toneChip)} aria-hidden="true">
            <Icon size={18} />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-9 w-20" />
      ) : (
        <p className={cn('mt-1 text-[30px] font-semibold leading-tight tracking-tight tabular', error ? 'text-subtle' : toneText)}>{error ? MISSING : display}</p>
      )}
      <p className={cn('mt-1.5 text-xs leading-snug', error ? 'text-danger' : 'text-subtle')}>{error ? (uiTestEnabled() ? 'No data loaded' : 'Could not load') : hint}</p>
    </>
  );

  const box = 'block rounded-ui-lg border border-border bg-page p-5 shadow-card';
  return href ? (
    <Link href={href} className={cn(box, 'transition-[border-color,box-shadow] hover:border-primary-border hover:shadow-pop')}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

/** Search box for list pages. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn('relative w-full sm:max-w-xs', className)}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-11 w-full rounded-ui border border-[var(--color-input-border)] bg-page pl-9 pr-3 text-sm text-fg placeholder:text-subtle transition-colors hover:border-primary-border focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary-soft"
      />
    </div>
  );
}
