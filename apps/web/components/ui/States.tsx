'use client';

import React from 'react';
import { AlertTriangle, Inbox, RefreshCw, type LucideIcon } from 'lucide-react';
import { Button } from './Button';
import { cn } from './cn';
import type { QueryState } from '@/lib/useApiQuery';

/** Placeholder for a value the API did not provide. Never substitute an invented value. */
export const MISSING = '—';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-ui-sm bg-surface-2', className)} />;
}

export function SkeletonRows({ rows = 5, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="p-5 space-y-3">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Shown when a query succeeded and returned no records. */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-6 py-12 gap-2', className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-ui bg-surface-2 text-subtle">
        <Icon size={20} aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-fg">{title}</p>
      {description && <p className="max-w-sm text-sm text-subtle">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
  className?: string;
}

/** Shown when a request fails. Never pair this with placeholder data. */
export function ErrorState({ title = 'Could not load data', message, onRetry, retrying, compact, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center text-center gap-2', compact ? 'p-4' : 'px-6 py-12', className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-ui bg-danger-soft text-danger">
        <AlertTriangle size={20} aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-fg">{title}</p>
      <p className="max-w-md text-sm text-muted">{message}</p>
      {onRetry && (
        <Button size="sm" icon={RefreshCw} onClick={onRetry} loading={retrying} className="mt-2">
          Retry
        </Button>
      )}
    </div>
  );
}

/** Inline message for a failed or successful action. */
export function Alert({
  tone = 'danger',
  title,
  children,
  onDismiss,
  className,
}: {
  tone?: 'danger' | 'warning' | 'success' | 'info';
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const tones = {
    danger: 'bg-danger-soft border-danger-border text-danger',
    warning: 'bg-warning-soft border-warning-border text-warning',
    success: 'bg-success-soft border-success-border text-success',
    info: 'bg-info-soft border-info-border text-info',
  };
  return (
    <div role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-ui border p-3 text-sm', tones[tone], className)}>
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className={cn(title && 'mt-0.5', 'text-fg/90')}>{children}</div>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 text-xs font-semibold underline underline-offset-2">
          Dismiss
        </button>
      )}
    </div>
  );
}

interface QueryViewProps<T> {
  query: QueryState<T>;
  /** Title for the error state. */
  errorTitle?: string;
  /** Returns true when the loaded data has nothing to show. */
  isEmpty?: (data: T) => boolean;
  empty?: React.ReactNode;
  loading?: React.ReactNode;
  children: (data: T) => React.ReactNode;
}

/**
 * Renders exactly one of: loading, error (with Retry), empty, or the data. A failed request is
 * never rendered as "no records".
 */
export function QueryView<T>({ query, errorTitle, isEmpty, empty, loading, children }: QueryViewProps<T>) {
  if (query.status === 'loading') return <>{loading ?? <SkeletonRows />}</>;
  if (query.status === 'error') {
    return <ErrorState title={errorTitle} message={query.error} onRetry={query.retry} retrying={query.isFetching} />;
  }
  if (isEmpty?.(query.data)) return <>{empty ?? <EmptyState title="No records yet" />}</>;
  return <div className={cn(query.isFetching && 'opacity-60 transition-opacity')}>{children(query.data)}</div>;
}

/** Retry icon for card headers when a refresh is useful. */
export function RefreshButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <Button size="sm" variant="ghost" icon={RefreshCw} onClick={onClick} loading={busy} aria-label="Refresh">
      <span className="sr-only sm:not-sr-only">Refresh</span>
    </Button>
  );
}
