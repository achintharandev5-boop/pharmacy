'use client';

import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

const FIELD_BASE =
  'w-full rounded-ui border bg-page text-sm text-fg placeholder:text-subtle transition-colors ' +
  'border-border-strong hover:border-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft ' +
  'disabled:bg-surface disabled:text-subtle disabled:cursor-not-allowed ' +
  'aria-invalid:border-danger aria-invalid:focus:ring-danger-soft';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(FIELD_BASE, 'h-10 px-3', className)} {...rest} />;
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea ref={ref} rows={rows} aria-invalid={invalid || undefined} className={cn(FIELD_BASE, 'px-3 py-2 resize-y', className)} {...rest} />
  );
});

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, invalid, children, ...rest }, ref) {
  return (
    <div className="relative">
      <select ref={ref} aria-invalid={invalid || undefined} className={cn(FIELD_BASE, 'h-10 pl-3 pr-9 appearance-none', className)} {...rest}>
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-subtle" aria-hidden="true" />
    </div>
  );
});

interface FieldChildProps {
  id: string;
  'aria-describedby'?: string;
  invalid?: boolean;
  required?: boolean;
}

interface FormFieldProps {
  label: string;
  /** Short help text shown under the control. */
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  /** Render prop receives the id and aria attributes to spread on the control. */
  children: (field: FieldChildProps) => React.ReactNode;
}

/** Label, control, hint and error, wired together for assistive technology. */
export function FormField({ label, hint, error, required, className, children }: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
        {required && (
          <span className="text-danger ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({ id, 'aria-describedby': describedBy, invalid: Boolean(error), required })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
