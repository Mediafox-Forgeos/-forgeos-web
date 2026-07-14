import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/forgeos/status-badge';
import { Card } from '@/components/ui/card';
import { roadmapPhases } from '@/data/roadmap';

export default function RoadmapPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
      <PageHeader
        eyebrow="Roadmap"
        title="The path to pilot"
        description="A focused sequence from platform foundation to real-world validation."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {roadmapPhases.map((phase, index) => (
          <Card key={phase.name} className="p-5">
            <span className="text-xs text-muted-foreground">0{index + 1}</span>
            <h2 className="mt-8 text-lg font-medium">{phase.name}</h2>
            <p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">
              {phase.detail}
            </p>
            <div className="mt-6">
              <StatusBadge status={phase.status} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
