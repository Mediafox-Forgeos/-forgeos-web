import * as React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'outline' | 'success' | 'warning' | 'danger' | 'blue' | 'violet';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-muted text-muted-foreground',
  outline: 'border border-border text-muted-foreground',
  success: 'bg-emerald-950 text-emerald-400 border border-emerald-900',
  warning: 'bg-amber-950 text-amber-400 border border-amber-900',
  danger: 'bg-red-950 text-red-400 border border-red-900',
  blue: 'bg-blue-950 text-blue-400 border border-blue-900',
  violet: 'bg-violet-950 text-violet-400 border border-violet-900',
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
