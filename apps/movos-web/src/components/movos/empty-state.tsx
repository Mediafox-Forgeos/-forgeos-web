import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {Icon && (
        <span className="bg-accent text-muted-foreground grid size-11 place-items-center rounded-lg">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="text-muted-foreground max-w-md text-sm">{description}</p>
      )}
      {action}
    </Card>
  );
}
