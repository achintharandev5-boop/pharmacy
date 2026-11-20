import React from 'react';
import { cn } from './cn';

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn('bg-page border border-border rounded-ui-lg shadow-card', className)} {...rest}>
      {children}
    </section>
  );
}

interface CardHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Heading level for the title; defaults to h2. */
  as?: 'h2' | 'h3';
}

export function CardHeader({ title, description, actions, className, as: Heading = 'h2' }: CardHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3.5 border-b border-border', className)}>
      <div className="min-w-0">
        <Heading className="text-[15px] font-semibold leading-snug tracking-tight text-fg">{title}</Heading>
        {description && <p className="mt-0.5 text-[13px] leading-snug text-subtle">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('p-6', className)}>{children}</div>;
}

/** A label/value pair for detail views. */
export function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] font-medium uppercase tracking-[0.06em] text-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg break-words">{children}</dd>
    </div>
  );
}
