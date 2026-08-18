import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { UnifiedAttentionWidget } from '@/components/operator/unified-attention-widget';
import { NetworkHealthWidget } from '@/components/operator/network-health-widget';
import { ActiveSessionsWidget } from '@/components/operator/active-sessions-widget';
import { FleetMap } from '@/components/operator/fleet-map';
import { StationStatusWidget } from '@/components/operator/station-status-widget';
import { TodaysScheduledWidget } from '@/components/operator/todays-scheduled-widget';
import { InProgressWidget } from '@/components/operator/in-progress-widget';
import { TechnicianWorkloadWidget } from '@/components/operator/technician-workload-widget';
import { RecentlyResolvedWidget } from '@/components/operator/recently-resolved-widget';
import { OperationalIntelligenceWidget } from '@/components/operator/operational-intelligence-widget';
import { OperationalActionsSection } from '@/components/operator/operational-actions-section';
import { DashboardLive } from './_dashboard-live';
import { DemoDataSection } from './_demo-data-section';

/**
 * WO-ARGOS-051 — Operations Console. /dashboard evolves in place (not a new
 * /operations route) into the operator's primary control surface.
 *
 * WO-ARGOS-057 — restructured (not just appended to) around the operator's
 * actual question order, per ARGOS's approved information hierarchy:
 *
 *   P0 NEEDS ACTION      — UnifiedAttentionWidget: "what needs me right now?"
 *   P1 NETWORK NOW        — NetworkHealthWidget: "is my network operating?"
 *   P1 ACTIVE CHARGING     — ActiveSessionsWidget: "what's charging right now?"
 *   P1 INFRASTRUCTURE STATUS — FleetMap + StationStatusWidget: drill-down
 *                              into Stations/EVSEs/Connectors
 *   P2 WORK MANAGEMENT     — Today's Scheduled, In Progress, Technician
 *                              Workload, Recently Resolved, Operational
 *                              Intelligence/Actions — kept, not deleted,
 *                              just visually subordinate to the above.
 *
 * ConnectivityWidget and OccupancyWidget are superseded by
 * NetworkHealthWidget (same underlying endpoints, consolidated into one
 * compact block) — not deleted this WO, same deferred-cleanup precedent as
 * SiteSelectionList after WO-054 (see WO_057_IMPLEMENTATION_REPORT). The
 * OperatorLive composition wrapper that used to render them is retired —
 * it was pure layout, fully superseded by this page's own structure.
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

      {/* P0 — Needs action */}
      <div className="mt-8">
        <UnifiedAttentionWidget />
      </div>

      {/* P1 — Network now */}
      <div className="mt-6">
        <NetworkHealthWidget />
      </div>

      {/* P1 — Active charging */}
      <div className="mt-6">
        <ActiveSessionsWidget />
      </div>

      {/* P1 — Infrastructure status: drill-down into Stations/EVSEs/Connectors */}
      <section className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold tracking-[-0.01em]">
          Estado de la infraestructura
        </h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <FleetMap />
          <StationStatusWidget />
        </div>
      </section>

      {/* P2 — Work management / context: kept, visually subordinate */}
      <section className="mt-10 space-y-4 border-t pt-6">
        <h2 className="text-muted-foreground text-sm font-medium tracking-[-0.01em]">
          Gestión de trabajo
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <TodaysScheduledWidget />
          <InProgressWidget />
        </div>

        <TechnicianWorkloadWidget />
        <OperationalIntelligenceWidget />
        <OperationalActionsSection />
        <RecentlyResolvedWidget />
      </section>

      <DemoDataSection />
    </PageContainer>
  );
}
