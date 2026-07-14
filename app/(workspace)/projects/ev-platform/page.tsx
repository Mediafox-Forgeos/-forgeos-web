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
        eyebrow="Projects / EV Platform"
        title="EV Platform"
        description={evPlatform.description}
        action={
          <div className="flex gap-2">
            <StatusBadge status={evPlatform.status} />
            <StatusBadge status={evPlatform.priority} />
          </div>
        }
      />
      <nav className="mt-6 flex gap-4 overflow-x-auto border-b border-border text-sm text-muted-foreground">
        {sections.map((section) => (
          <a
            key={section}
            href={`#${section.toLowerCase()}`}
            className="shrink-0 border-b border-transparent py-3 hover:border-muted-foreground hover:text-foreground"
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
                className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground"
              >
                {capability}
              </span>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <p className="text-xs font-medium text-muted-foreground">Pilot</p>
          <p className="mt-3 text-lg font-medium">{evPlatform.pilot}</p>
          <p className="mt-6 text-xs font-medium text-muted-foreground">
            Project Status
          </p>
          <div className="mt-3">
            <StatusBadge status={evPlatform.status} />
          </div>
        </Card>
      </section>
      <section id="roadmap" className="mt-10">
        <h2 className="mb-4 text-sm font-medium">Roadmap</h2>
        <Card className="p-5 text-sm text-muted-foreground">
          Foundation is the active phase. See the Forge roadmap for the
          operating sequence.
        </Card>
      </section>
      <section id="architecture" className="mt-10">
        <h2 className="mb-4 text-sm font-medium">Architecture</h2>
        <Card className="p-5 text-sm text-muted-foreground">
          API First · Multi-Tenant · Multi-Operator
        </Card>
      </section>
      <section id="backlog" className="mt-10">
        <h2 className="mb-4 text-sm font-medium">Backlog</h2>
        <Card className="p-5 text-sm text-muted-foreground">
          Current backlog is represented by the Foundation sprint.
        </Card>
      </section>
      <section id="risks" className="mt-10">
        <h2 className="mb-4 text-sm font-medium">Risks</h2>
        <Card className="p-5 text-sm text-muted-foreground">
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
