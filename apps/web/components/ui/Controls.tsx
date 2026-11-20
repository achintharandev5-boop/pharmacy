'use client';

import React, { useId } from 'react';
import { cn } from './cn';
import { Input } from './Form';

type InputProps = React.ComponentProps<typeof Input>;
export const TextInput = React.forwardRef<HTMLInputElement, InputProps>(function TextInput(props, ref) { return <Input {...props} ref={ref} />; });
export const NumberInput = React.forwardRef<HTMLInputElement, InputProps>(function NumberInput(props, ref) { return <Input {...props} ref={ref} type="number" />; });
export const DatePicker = React.forwardRef<HTMLInputElement, InputProps>(function DatePicker(props, ref) { return <Input {...props} ref={ref} type="date" />; });
export const TimePicker = React.forwardRef<HTMLInputElement, InputProps>(function TimePicker(props, ref) { return <Input {...props} ref={ref} type="time" />; });

export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Checkbox({ className, ...props }, ref) {
  return <input {...props} ref={ref} type="checkbox" className={cn('h-5 w-5 shrink-0 cursor-pointer rounded border-border-strong accent-primary disabled:cursor-not-allowed', className)} />;
});

export function ToggleSwitch({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm text-fg">
    <span className="relative inline-flex items-center">
      <input {...props} type="checkbox" role="switch" aria-label={label} className="peer sr-only" />
      <span aria-hidden="true" className="h-6 w-11 rounded-full border border-border-strong bg-surface-2 transition-colors peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:opacity-50" />
      <span aria-hidden="true" className="pointer-events-none absolute left-1 h-4 w-4 rounded-full bg-muted transition-transform peer-checked:translate-x-5 peer-checked:bg-[var(--color-on-primary)]" />
    </span>
    <span>{label}</span>
  </label>;
}

export function RadioGroup({ label, name, options, value, onChange, disabled }: {
  label: string; name?: string; options: { value: string; label: string }[]; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const id = useId();
  return <fieldset disabled={disabled} className="space-y-2"><legend className="text-sm font-medium text-fg">{label}</legend>
    {options.map(option => <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-fg">
      <input type="radio" name={name || id} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="h-5 w-5 accent-primary" />{option.label}
    </label>)}
  </fieldset>;
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <fieldset className="space-y-4 rounded-ui-lg border border-border bg-page p-6">
    <legend className="px-2 text-base font-semibold text-fg">{title}</legend>
    {description && <p className="text-sm text-muted">{description}</p>}{children}
  </fieldset>;
}

