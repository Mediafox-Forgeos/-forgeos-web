import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/forgeos/status-badge';
import type { Client } from '@/types';

export function ClientCard({ client }: { client: Client }) {
  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-muted-foreground text-xs font-medium">Client</p>
          <h2 className="mt-2 text-2xl font-medium tracking-tight">
            {client.name}
          </h2>
        </div>
        <StatusBadge status={client.status} />
      </div>
      <p className="mt-10 max-w-xl text-balance text-lg leading-8">
        {client.note}
      </p>
    </Card>
  );
}
