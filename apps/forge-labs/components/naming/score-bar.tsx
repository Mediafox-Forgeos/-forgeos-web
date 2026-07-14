import { cn } from '@/lib/utils';

interface ScoreBarProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function ScoreBar({ value, max = 100, size = 'md', className }: ScoreBarProps) {
  const pct = Math.round((value / max) * 100);
  const color =
    pct >= 85 ? 'bg-emerald-500' :
    pct >= 70 ? 'bg-labs-blue' :
    pct >= 55 ? 'bg-amber-500' :
    'bg-red-500';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'relative overflow-hidden rounded-full bg-muted',
          size === 'sm' ? 'h-1 w-16' : 'h-1.5 w-24',
        )}
      >
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('tabular-nums text-foreground', size === 'sm' ? 'text-xs' : 'text-sm')}>
        {value.toFixed(0)}
      </span>
    </div>
  );
}
