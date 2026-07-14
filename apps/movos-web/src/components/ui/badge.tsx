import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-accent text-muted-foreground',
        info: 'border-movos-blue/40 bg-movos-blue/10 text-movos-blue',
        success: 'border-emerald-900 bg-emerald-950/40 text-emerald-300',
        warning: 'border-amber-900 bg-amber-950/40 text-amber-300',
        danger: 'border-red-900 bg-red-950/40 text-red-300',
        muted: 'border-border bg-transparent text-muted-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
