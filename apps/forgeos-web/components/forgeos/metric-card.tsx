import type { LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import type { Metric } from '@/types';

type MetricCardProps = {
  metric: Metric;
  icon?: LucideIcon;
};

export function MetricCard({ metric, icon: Icon }: MetricCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-muted-foreground text-xs font-medium">
          {metric.label}
        </span>
        {Icon && (
          <Icon
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden="true"
          />
        )}
      </div>
      <p className="mt-6 text-lg font-medium tracking-[-0.02em]">
        {metric.value}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">{metric.detail}</p>
    </Card>
  );
}
