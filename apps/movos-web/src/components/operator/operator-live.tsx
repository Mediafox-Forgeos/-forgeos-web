'use client';

import { FleetMap } from './fleet-map';
import { StationStatusWidget } from './station-status-widget';
import { ConnectivityWidget } from './connectivity-widget';
import { OccupancyWidget } from './occupancy-widget';
import { ActiveSessionsWidget } from './active-sessions-widget';
import { OperationalIntelligenceWidget } from './operational-intelligence-widget';

/**
 * CAP-X Operator Control Center, Sprint 1 (WO-ARGOS-022) — Objective 3:
 * "crear la vista operacional principal." Composes the map, station
 * status, connectivity, occupancy, and active-sessions widgets over real
 * data (CAP-002 through CAP-009), plus the Operational Intelligence
 * widget (WO-ARGOS-025). No Alert/Incident/MaintenanceTicket UI is
 * rendered here. See docs/implementation/CAPX_SPRINT_1_TECHNICAL_NOTES.md
 * and docs/implementation/OPERATIONAL_INTELLIGENCE_TECHNICAL_NOTES.md.
 */
export function OperatorLive() {
  return (
    <section className="mt-8 space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.01em]">
          Vista operacional en vivo
        </h2>
        <p className="text-muted-foreground text-sm">
          Datos reales de infraestructura y sesiones — CAP-002 a CAP-009.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <FleetMap />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StationStatusWidget />
          <ConnectivityWidget />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ActiveSessionsWidget />
        <OccupancyWidget />
      </div>

      <OperationalIntelligenceWidget />
    </section>
  );
}
