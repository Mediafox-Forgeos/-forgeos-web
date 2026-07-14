import { Plus } from 'lucide-react';

import { StatusBadge } from '@/components/forgeos/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { decisions } from '@/data/decisions';

export default function DecisionsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
      <PageHeader
        eyebrow="Decisions"
        title="Architecture Decision Records"
        description="Decisions preserve the reasoning behind how ForgeOS and its products evolve."
        action={
          <Button>
            <Plus className="size-4" /> New Decision
          </Button>
        }
      />
      <Card className="mt-10 divide-y divide-border">
        {decisions.map((decision) => (
          <article
            key={decision.id}
            className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {decision.id}
              </p>
              <h2 className="mt-2 text-base font-medium">{decision.title}</h2>
            </div>
            <StatusBadge status={decision.status} />
          </article>
        ))}
      </Card>
    </div>
  );
}
