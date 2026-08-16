import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { RequiresAttentionWidget } from '@/components/operator/requires-attention-widget';
import { TodaysScheduledWidget } from '@/components/operator/todays-scheduled-widget';
import { InProgressWidget } from '@/components/operator/in-progress-widget';
import { TechnicianWorkloadWidget } from '@/components/operator/technician-workload-widget';
import { RecentlyResolvedWidget } from '@/components/operator/recently-resolved-widget';
import { OperatorLive } from '@/components/operator/operator-live';
import { DashboardLive } from './_dashboard-live';
import { DemoDataSection } from './_demo-data-section';

/**
 * WO-ARGOS-051 — Operations Console. /dashboard evolves in place (not a new
 * /operations route) into the operator's primary control surface: "what is
 * happening in my operation right now, and what requires my attention?"
 * Target hierarchy (ARGOS's approved spec, product decision 7):
 * 1. Requires attention, 2. Today's scheduled work, 3. Work in progress,
 * 4. Technician workload, 5. Sites/stations snapshot (existing, reused via
 * OperatorLive), 6. Recommendations/Actions (existing, reused via
 * OperatorLive), 7. Recently resolved. Demo data moved to its own
 * collapsed, explicitly-labeled section — never visually equivalent to the
 * real sections above it.
 */
export default function DashboardPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="MOVOS"
        title="Centro de Operaciones"
        description="Qué está pasando en tu operación ahora mismo, y qué requiere tu atención."
      />

      <DashboardLive />

      <div className="mt-8">
        <RequiresAttentionWidget />
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <TodaysScheduledWidget />
        <InProgressWidget />
      </section>

      <div className="mt-6">
        <TechnicianWorkloadWidget />
      </div>

      <OperatorLive />

      <div className="mt-6">
        <RecentlyResolvedWidget />
      </div>

      <DemoDataSection />
    </PageContainer>
  );
}
