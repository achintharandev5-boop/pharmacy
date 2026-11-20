import React from 'react';
import { cn } from './cn';

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border-border',
  primary: 'bg-primary-soft text-primary-hover border-primary-border',
  success: 'bg-success-soft text-success border-success-border',
  warning: 'bg-warning-soft text-warning border-warning-border',
  danger: 'bg-danger-soft text-danger border-danger-border',
  info: 'bg-info-soft text-info border-info-border',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-ui-sm border px-2 py-0.5 text-xs font-medium leading-5 whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Known status codes from the API, with their display label and tone. Unknown codes are shown as-is. */
const STATUS: Record<string, { label: string; tone: Tone }> = {
  COMPLETED: { label: 'Completed', tone: 'success' },
  DRAFT: { label: 'Draft', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  ACTIVE: { label: 'Active', tone: 'success' },
  DEPLETED: { label: 'Depleted', tone: 'neutral' },
  EXPIRED: { label: 'Expired', tone: 'danger' },
  EXPIRES_SOON: { label: 'Expires soon', tone: 'warning' },
  QUARANTINED: { label: 'Quarantined', tone: 'danger' },
  LOW_STOCK: { label: 'Low stock', tone: 'warning' },
  LOW: { label: 'Low stock', tone: 'warning' },
  CRITICAL: { label: 'Critical', tone: 'danger' },
  OUT_OF_STOCK: { label: 'Out of stock', tone: 'danger' },
  HEALTHY: { label: 'In stock', tone: 'success' },
  UNCLASSIFIED: { label: 'Not configured', tone: 'neutral' },
  PRINTED: { label: 'Printed', tone: 'success' },
  REPRINTED: { label: 'Reprinted', tone: 'warning' },
  CREATED: { label: 'Created', tone: 'primary' },
  SMS_SENT: { label: 'SMS sent', tone: 'info' },
  SMS_FAILED: { label: 'SMS failed', tone: 'danger' },
  DISPENSE: { label: 'Dispensed', tone: 'primary' },
  STOCK_RECEIVED: { label: 'Received', tone: 'success' },
  ADJUSTMENT_IN: { label: 'Adjustment in', tone: 'info' },
  ADJUSTMENT_OUT: { label: 'Adjustment out', tone: 'warning' },
  DAMAGED: { label: 'Damaged', tone: 'danger' },
  RETURNED: { label: 'Returned (legacy)', tone: 'neutral' },
  SUPPLIER_RETURN: { label: 'Returned to supplier', tone: 'warning' },
  HELD_FOR_REVIEW: { label: 'Held for review', tone: 'warning' },
  DISPOSED: { label: 'Disposed', tone: 'neutral' },
};

export function statusInfo(code: string | null | undefined): { label: string; tone: Tone } {
  if (!code) return { label: 'Unknown', tone: 'neutral' };
  return STATUS[code.toUpperCase()] ?? { label: code.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()), tone: 'neutral' };
}

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const { label, tone } = statusInfo(status);
  return (
    <Badge tone={tone} className={className}>
      {label}
    </Badge>
  );
}
