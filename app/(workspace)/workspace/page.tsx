import { ActivityFeed } from '@/components/forgeos/activity-feed';
import { SprintProgress } from '@/components/forgeos/sprint-progress';
import { PageHeader } from '@/components/layout/page-header';
import { currentSprint, workspaceRecentActivity } from '@/data/workspace';
import { Card } from '@/components/ui/card';

export default function WorkspacePage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
      <PageHeader
        eyebrow="Workspace"
        title="Operational focus"
        description="The current work that connects ForgeOS and EV Platform."
      />
      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-8">
          <SprintProgress sprint={currentSprint} />
          <section>
            <h2 className="mb-4 text-sm font-medium">Recent Activity</h2>
            <ActivityFeed items={workspaceRecentActivity} />
          </section>
        </div>
        <div className="space-y-5">
          <Card className="p-5">
            <p className="text-xs font-medium text-muted-foreground">
              Current Priority
            </p>
            <p className="mt-4 text-lg leading-7 tracking-tight">
              {currentSprint.priority}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium text-muted-foreground">
              Next Milestones
            </p>
            <ul className="mt-5 space-y-3">
              {currentSprint.milestones.map((milestone) => (
                <li key={milestone} className="text-sm text-muted-foreground">
                  {milestone}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
