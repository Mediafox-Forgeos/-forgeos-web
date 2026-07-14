import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { MetricTrend } from '@/types';

type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
  trend?: MetricTrend;
  icon?: LucideIcon;
};

const trendIcon: Record<MetricTrend, LucideIcon> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
};

const trendColor: Record<MetricTrend, string> = {
  up: 'text-emerald-400',
  down: 'text-amber-400',
  flat: 'text-muted-foreground',
};

export function MetricCard({
  label,
  value,
  detail,
  trend,
  icon: Icon,
}: MetricCardProps) {
  const TrendIcon = trend ? trendIcon[trend] : null;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-muted-foreground text-xs font-medium">
          {label}
        </span>
        {Icon && (
          <Icon
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
        )}
      </div>
      <div className="mt-5 flex items-baseline gap-2">
        <p className="text-2xl font-semibold tracking-[-0.02em]">{value}</p>
        {TrendIcon && trend && (
          <TrendIcon
            className={cn('size-4', trendColor[trend])}
            aria-hidden="true"
          />
        )}
      </div>
      {detail && <p className="text-muted-foreground mt-1 text-xs">{detail}</p>}
    </Card>
  );
}
