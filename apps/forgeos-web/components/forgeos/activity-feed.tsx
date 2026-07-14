import { Clock3 } from 'lucide-react';

import { Card } from '@/components/ui/card';
import type { ActivityItem } from '@/types';

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card className="divide-border divide-y">
      {items.map((item) => (
        <article key={item.id} className="flex gap-4 p-4 sm:p-5">
          <Clock3
            className="text-muted-foreground mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <h3 className="text-sm font-medium">{item.title}</h3>
              <span className="text-muted-foreground text-xs">
                {item.timestamp}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              {item.detail}
            </p>
          </div>
        </article>
      ))}
    </Card>
  );
}
