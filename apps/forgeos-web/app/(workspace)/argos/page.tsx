import { ActivityFeed } from '@/components/forgeos/activity-feed';
import { ArgosComposer } from '@/components/forgeos/argos-composer';
import { MetricCard } from '@/components/forgeos/metric-card';
import { PageHeader } from '@/components/layout/page-header';
import {
  argosQuickActions,
  argosRecentActivity,
  executiveMetrics,
} from '@/data/argos';
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  GitPullRequest,
  Target,
} from 'lucide-react';

const metricIcons = [
  Target,
  Building2,
  Building2,
  AlertTriangle,
  GitPullRequest,
  CheckCircle2,
];

export default function ArgosPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
      <PageHeader
        eyebrow="ARGOS"
        title="Chief AI Orchestrator"
        description="Good morning Álvaro."
      />
      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section>
          <h2 className="text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            What are we building today?
          </h2>
          <div className="mt-7">
            <ArgosComposer quickActions={argosQuickActions} />
          </div>
          <section className="mt-14" aria-labelledby="argos-activity">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="text-muted-foreground size-4" />
              <h2 id="argos-activity" className="text-sm font-medium">
                Recent Activity
              </h2>
            </div>
            <ActivityFeed items={argosRecentActivity} />
          </section>
        </section>
        <aside className="xl:border-border xl:border-l xl:pl-8">
          <h2 className="mb-4 text-sm font-medium">Executive Status</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {executiveMetrics.map((metric, index) => (
              <MetricCard
                key={metric.label}
                metric={metric}
                icon={metricIcons[index]}
              />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
