'use client';

import React from 'react';
import Link from 'next/link';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-soft' | 'outline' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'touch';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-solid text-[var(--color-on-primary-solid)] border border-primary-solid shadow-[0_1px_2px_rgb(82_54_176/0.22)] hover:bg-primary-solid-hover hover:border-primary-solid-hover active:bg-primary-solid-active',
  outline: 'bg-transparent text-fg border border-border-strong hover:bg-[var(--color-tint)] hover:border-primary-border',
  success: 'bg-success text-[var(--color-on-success)] border border-success hover:brightness-95',
  secondary: 'bg-page text-fg border border-border shadow-card hover:bg-[var(--color-tint)] hover:border-primary-border',
  ghost: 'bg-transparent text-muted border border-transparent hover:bg-[var(--color-tint)] hover:text-fg',
  danger: 'bg-danger text-[var(--color-on-danger)] border border-danger hover:brightness-95',
  'danger-soft': 'bg-danger-soft text-danger border border-danger-border hover:brightness-95',
};

// Small 36px, medium 44px, large 48px, touch 56px.
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-xs gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
  touch: 'h-14 px-6 text-base gap-3',
};

// Square, without padding. cn() does not resolve conflicting utilities, so an icon-only button
// must not receive SIZES' horizontal padding at all (it would squeeze the icon to a few pixels).
const ICON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-12 w-12 text-base',
  touch: 'h-14 w-14 text-base',
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
  iconOnly,
}: Pick<CommonProps, 'variant' | 'size' | 'fullWidth' | 'className'> & { iconOnly?: boolean }) {
  return cn(
    'inline-flex items-center justify-center rounded-ui font-semibold whitespace-nowrap select-none transition-[background-color,border-color,color,box-shadow]',
    'disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:cursor-not-allowed',
    VARIANTS[variant],
    iconOnly ? ICON_SIZES[size] : SIZES[size],
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
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={buttonClasses({ variant, size, className, iconOnly: true })}
      {...rest}
    >
      <Icon size={size === 'sm' ? 14 : size === 'lg' ? 22 : 18} aria-hidden="true" />
    </button>
  );
}
