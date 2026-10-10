'use client';

import React from 'react';
import Link from 'next/link';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-soft';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover border border-primary',
  secondary: 'bg-page text-fg border border-border-strong hover:bg-surface',
  ghost: 'bg-transparent text-muted border border-transparent hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger text-white border border-danger hover:brightness-95',
  'danger-soft': 'bg-danger-soft text-danger border border-danger-border hover:bg-[#fee2e2]',
};

// sm 32px, md 40px, lg 48px (touch workstations).
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function buttonClasses({
  variant = 'secondary',
  size = 'md',
  fullWidth,
  className,
}: Pick<CommonProps, 'variant' | 'size' | 'fullWidth' | 'className'>) {
  return cn(
    'inline-flex items-center justify-center rounded-ui font-semibold whitespace-nowrap select-none transition-colors',
    'disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:cursor-not-allowed',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className,
  );
}

type ButtonProps = CommonProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size = 'md', icon: Icon, iconRight: IconRight, loading, fullWidth, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon size={iconSize} aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && <IconRight size={iconSize} aria-hidden="true" />}
    </button>
  );
});

type LinkButtonProps = CommonProps & { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'>;

export function LinkButton({ href, variant, size = 'md', icon: Icon, iconRight: IconRight, fullWidth, className, children, ...rest }: LinkButtonProps) {
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;
  return (
    <Link href={href} className={buttonClasses({ variant, size, fullWidth, className })} {...rest}>
      {Icon && <Icon size={iconSize} aria-hidden="true" />}
      {children}
      {IconRight && <IconRight size={iconSize} aria-hidden="true" />}
    </Link>
  );
}

/** Square icon-only button. `label` is required: it is the accessible name. */
export function IconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  className,
  ...rest
}: { icon: LucideIcon; label: string; variant?: ButtonVariant; size?: ButtonSize } & Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
>) {
  const box = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(buttonClasses({ variant, size, className }), box, 'px-0')}
      {...rest}
    >
      <Icon size={size === 'sm' ? 14 : size === 'lg' ? 22 : 18} aria-hidden="true" />
    </button>
  );
}
