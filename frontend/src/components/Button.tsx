import React from 'react';
import Spinner from './Spinner';

// The design system has exactly three button roles plus a quiet ghost:
//   primary     one per view — the main action (filled)
//   secondary   everything else (quiet outline)
//   destructive red outline for stop/reset/remove
//   ghost       borderless, for icon-only / low-emphasis controls
// Status (running/stopped/etc.) is never expressed as a button colour — that
// lives in status dots and badges. Legacy variant/color names are still
// accepted and mapped onto these roles so existing call sites stay cohesive.
type ButtonRole = 'primary' | 'secondary' | 'destructive' | 'ghost';
type LegacyVariant = ButtonRole | 'success' | 'danger' | 'warning' | 'info' | 'neutral';
type LegacyColor = 'blue' | 'gray' | 'green' | 'red' | 'yellow' | 'purple' | 'pink';

type ButtonProps = {
  variant?: LegacyVariant;
  color?: LegacyColor;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  outline?: boolean;
  pill?: boolean;
  loading?: boolean;
  className?: string;
  children: React.ReactNode;
  tooltip?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

function resolveRole(variant?: LegacyVariant, color?: LegacyColor): ButtonRole {
  if (variant) {
    switch (variant) {
      case 'primary': return 'primary';
      case 'danger':
      case 'destructive': return 'destructive';
      case 'ghost': return 'ghost';
      // success/warning/info/neutral are not distinct button colours — they
      // collapse to the quiet secondary role.
      default: return 'secondary';
    }
  }
  switch (color) {
    case 'blue': return 'primary';
    case 'red': return 'destructive';
    default: return 'secondary';
  }
}

const roleClasses: Record<ButtonRole, string> = {
  primary:
    'bg-blue-600 hover:bg-blue-700 text-white border border-transparent shadow-sm focus-visible:ring-blue-500',
  secondary:
    'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus-visible:ring-gray-400',
  destructive:
    'bg-transparent text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 focus-visible:ring-red-400',
  ghost:
    'bg-transparent text-gray-600 dark:text-gray-300 border border-transparent hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:ring-gray-400',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  xs: 'px-2 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
  xl: 'px-6 py-3 text-base',
};

export default function Button({
  children,
  variant,
  color,
  size = 'md',
  outline: _outline,
  pill = false,
  loading = false,
  className = '',
  disabled = false,
  tooltip,
  ...rest
}: ButtonProps) {
  const role = resolveRole(variant, color);
  const base =
    'inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none whitespace-nowrap';

  return (
    <button
      className={`${base} ${roleClasses[role]} ${sizeClasses[size]} ${pill ? 'rounded-full' : 'rounded-lg'} ${className}`}
      disabled={disabled || loading}
      title={tooltip}
      {...rest}
    >
      {children}
      {loading && <Spinner size={size} className="ml-1" />}
    </button>
  );
}
