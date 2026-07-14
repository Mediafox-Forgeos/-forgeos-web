import { cn } from '@/lib/utils';
import type { Status } from '@/types';

const toneClasses = {
  neutral: 'border-border bg-accent text-muted-foreground',
  healthy: 'border-emerald-950 bg-emerald-950/30 text-emerald-300',
  critical: 'border-amber-950 bg-amber-950/30 text-amber-300',
  pending: 'border-border bg-transparent text-muted-foreground',
} as const;

export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md border px-2 py-1 text-xs font-medium',
        toneClasses[status.tone ?? 'neutral'],
        className,
      )}
    >
      {status.label}
    </span>
  );
}
