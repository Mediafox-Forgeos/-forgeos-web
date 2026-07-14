import { ActivityFeed } from '@/components/forgeos/activity-feed';
import { StatusBadge } from '@/components/forgeos/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { evPlatform, evPlatformActivity } from '@/data/projects';

const sections = [
  'Overview',
  'Roadmap',
  'Architecture',
  'Backlog',
  'Risks',
  'Activity',
];

export default function EvPlatformPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
      <PageHeader
        eyebrow="Projects / MOVOS"
        title="MOVOS"
        description={evPlatform.description}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={evPlatform.status} />
            <StatusBadge status={evPlatform.priority} />
            <a
              href={
                process.env.NEXT_PUBLIC_MOVOS_URL ?? 'http://localhost:3002'
              }
              target="_blank"
              rel="noopener noreferrer"
              className="border-border hover:bg-accent inline-flex items-center rounded-md border px-3 py-1 text-sm transition-colors"
            >
              Open MOVOS
            </a>
          </div>
        }
      />
      <nav className="border-border text-muted-foreground mt-6 flex gap-4 overflow-x-auto border-b text-sm">
        {sections.map((section) => (
          <a
            key={section}
            href={`#${section.toLowerCase()}`}
            className="hover:border-muted-foreground hover:text-foreground shrink-0 border-b border-transparent py-3"
          >
            {section}
          </a>
        ))}
      </nav>
      <section
        id="overview"
        className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]"
      >
        <Card className="p-6">
          <h2 className="text-sm font-medium">Overview</h2>
          <p className="mt-5 max-w-2xl text-lg leading-8">
            {evPlatform.description}
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {evPlatform.capabilities.map((capability) => (
              <span
                key={capability}
                className="border-border text-muted-foreground rounded-md border px-3 py-2 text-sm"
              >
                {capability}
              </span>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <p className="text-muted-foreground text-xs font-medium">Pilot</p>
          <p className="mt-3 text-lg font-medium">{evPlatform.pilot}</p>
          <p className="text-muted-foreground mt-6 text-xs font-medium">
            Project Status
          </p>
          <div className="mt-3">
            <StatusBadge status={evPlatform.status} />
          </div>
        </Card>
      </section>
      <section id="roadmap" className="mt-10">
        <h2 className="mb-4 text-sm font-medium">Roadmap</h2>
        <Card className="text-muted-foreground p-5 text-sm">
          Foundation is the active phase. See the Forge roadmap for the
          operating sequence.
        </Card>
      </section>
      <section id="architecture" className="mt-10">
        <h2 className="mb-4 text-sm font-medium">Architecture</h2>
        <Card className="text-muted-foreground p-5 text-sm">
          API First · Multi-Tenant · Multi-Operator
        </Card>
      </section>
      <section id="backlog" className="mt-10">
        <h2 className="mb-4 text-sm font-medium">Backlog</h2>
        <Card className="text-muted-foreground p-5 text-sm">
          Current backlog is represented by the Foundation sprint.
        </Card>
      </section>
      <section id="risks" className="mt-10">
        <h2 className="mb-4 text-sm font-medium">Risks</h2>
        <Card className="text-muted-foreground p-5 text-sm">
          Three open risks require executive review in ARGOS.
        </Card>
      </section>
      <section id="activity" className="mt-10">
        <h2 className="mb-4 text-sm font-medium">Activity</h2>
        <ActivityFeed items={evPlatformActivity} />
      </section>
    </div>
  );
}
