# CAP-X — Internal Contracts

**Work order:** WO-ARGOS-019 (CAP-X Architecture)
**Status:** ARCHITECTURE ONLY. Every signature below is documentation — a proposed shape, not a `.ts` file. No interface, class, or NestJS module is created by this document, matching the work order's deliverable list (five markdown files, no code). This mirrors, in prose form, the discipline CAP-009's real interface files (`apps/movos-api/src/billing/*.interface.ts`) already established: name the contract precisely enough that a future implementation has no ambiguity, without writing the implementation itself.
**Part of:** [CAP-X_OPERATOR_DOMAIN.md](./CAP-X_OPERATOR_DOMAIN.md).

## Objective 6 — Proposed internal contracts

### Boundary rule, stated once, applying to every contract below

**No method on any service in this document ever writes to `ChargingStation`, `Evse`, `Connector`, `ChargingSession`, or any other CAP-002/CAP-004/CAP-005 model.** Every read is a query; every write targets only this domain's own entities (`Alert`, `Incident`, `MaintenanceTicket`, `OccupancySnapshot`, `DashboardWidget`). This is the same non-negotiable boundary [CAP-X_OPERATOR_DOMAIN.md](./CAP-X_OPERATOR_DOMAIN.md) states in prose — restated here because a contract document is where that boundary would actually be violated first, one convenience method at a time, if not held explicitly.

### AlertDetectionService

The rule evaluator described in [CAP-X_INCIDENT_FLOW.md](./CAP-X_INCIDENT_FLOW.md) Stage 1. Event-driven, not polled — reacts to transitions already emitted by existing services (`ConnectivityCoordinator`, `SessionLifecycleService`) rather than scanning state on a timer, the same pattern `ConnectivityCoordinator` itself already uses to react to `ConnectionRegistryService` events.

```
interface AlertDetectionService {
  // Called by ConnectivityCoordinator's existing transition point (CAP-005) —
  // does not modify ChargingStation.connectivityStatus itself, only reacts to it.
  onConnectivityTransition(stationId: string, from: ConnectivityStatus, to: ConnectivityStatus): Promise<void>;

  // Called by SessionLifecycleService's existing OFFLINE-transition point (CAP-005) —
  // does not modify ChargingSession.status itself.
  onSessionOffline(sessionId: string): Promise<void>;

  // Called wherever a session first crosses the stuck-session age threshold —
  // may be invoked by a scheduled sweep (analogous to CAP-005's own stale-connection
  // sweep) rather than a synchronous event, since "has this been OFFLINE for 15
  // minutes" is inherently a time-elapsed check, not a state-transition reaction.
  evaluateStuckSessions(): Promise<void>;

  // Called wherever Connector/Evse.status transitions to FAULTED (CAP-002/CAP-003) —
  // does not modify Connector/Evse.status itself.
  onConnectorFault(connectorId: string): Promise<void>;

  // Scheduled evaluation for the two rolling-window rules (flapping, high failure
  // rate) — cannot be event-driven the way the transition-based rules above are,
  // since crossing a recurrence/rate threshold is a property of a window, not a
  // single event.
  evaluateRollingWindowRules(scope: { organizationId: string }): Promise<void>;
}
```

### AlertService

CRUD and lifecycle transitions over `Alert` itself — [CAP-X_INCIDENT_FLOW.md](./CAP-X_INCIDENT_FLOW.md) Stage 2's state machine.

```
interface AlertService {
  acknowledge(alertId: string, byUserId: string): Promise<Alert>;
  dismiss(alertId: string, byUserId: string, reason: string): Promise<Alert>;

  // Called by AlertDetectionService when the reverse condition is observed
  // (e.g., connectivity returns to ONLINE). Never called directly by a human.
  markSelfResolved(alertId: string): Promise<Alert>;

  // Called by AlertDetectionService or by an operator's manual escalation —
  // creates or attaches to an Incident. See IncidentService.openFromAlert.
  escalate(alertId: string, byUserId?: string): Promise<Incident>;

  countOpenByType(scope: { organizationId: string; siteId?: string }, type: AlertType): Promise<number>;
  recurrenceReport(scope: { organizationId: string; siteId?: string }, range: DateRange): Promise<FaultRecurrenceRow[]>;
}
```

### IncidentService

[CAP-X_INCIDENT_FLOW.md](./CAP-X_INCIDENT_FLOW.md) Stages 3–5.

```
interface IncidentService {
  // Creates a new Incident from one Alert, or attaches the Alert to an existing
  // open Incident for the same station/connector if one exists (the
  // deduplication behavior CAP-X_INCIDENT_FLOW.md's "flapping connector"
  // example depends on).
  openFromAlert(alertId: string): Promise<Incident>;

  assign(incidentId: string, assigneeUserId: string): Promise<Incident>;

  // Enforces the "notes required" rule from CAP-X_INCIDENT_FLOW.md Stage 4 —
  // rejects the call if resolutionNotes is empty.
  resolve(incidentId: string, resolutionNotes: string): Promise<Incident>;

  close(incidentId: string, byUserId: string): Promise<Incident>;

  // Enforces the 48-hour reopening rule from CAP-X_INCIDENT_FLOW.md Stage 4 —
  // called by AlertService.escalate when it detects a recent prior Incident
  // for the same station/connector, rather than opening a duplicate.
  reopen(incidentId: string, newAlertId: string): Promise<Incident>;

  // Backs the ATTENTION_QUEUE widget (CAP-X_WIDGETS.md) — ranked per the
  // three-tier ordering from OPERATOR_DAILY_WORKFLOW.md, combining open
  // Incidents and unescalated-but-unacknowledged CRITICAL/WARNING Alerts.
  listAttentionQueue(scope: { organizationId: string; siteId?: string }): Promise<AttentionQueueItem[]>;
}
```

### MaintenanceTicketService

[CAP-X_INCIDENT_FLOW.md](./CAP-X_INCIDENT_FLOW.md) Stage 4's maintenance-ticket resolution path.

```
interface MaintenanceTicketService {
  // Rejects the call if the given Incident already has a non-CANCELLED ticket —
  // the one-ticket-per-incident-at-a-time rule implied but not yet stated
  // explicitly in CAP-X_OPERATOR_DOMAIN.md; stated here where it's enforced.
  createFromIncident(incidentId: string, priority: MaintenancePriority): Promise<MaintenanceTicket>;

  schedule(ticketId: string, scheduledFor: Date, assignedToUserId?: string): Promise<MaintenanceTicket>;
  start(ticketId: string): Promise<MaintenanceTicket>;

  // Triggers the linked Incident's AWAITING_MAINTENANCE -> RESOLVED transition
  // (CAP-X_INCIDENT_FLOW.md Stage 4) as a side effect — the one place in this
  // contract set where completing one entity directly mutates another,
  // documented here rather than left implicit.
  complete(ticketId: string, resolutionNotes: string): Promise<MaintenanceTicket>;

  // Triggers the linked Incident's AWAITING_MAINTENANCE -> INVESTIGATING
  // transition — the work didn't happen, the incident is still open.
  cancel(ticketId: string, reason: string): Promise<MaintenanceTicket>;
}
```

### StationHealthService

Pure computation, per [CAP-X_STATION_HEALTH.md](./CAP-X_STATION_HEALTH.md) — every method here is a read; nothing is persisted by this service (`StationHealth` is explicitly not a stored entity).

```
interface StationHealthService {
  // The core function: applies the precedence rules from CAP-X_STATION_HEALTH.md
  // to one station's current ChargingStationStatus/ConnectivityStatus/
  // Evse+Connector.status/open Alert+MaintenanceTicket state.
  computeHealth(stationId: string): Promise<StationHealthResult>;

  // Backs the FLEET_STATUS widget.
  summarizeFleet(scope: { organizationId: string; siteId?: string }): Promise<FleetHealthSummary>;

  // Backs the CONNECTIVITY widget — narrower than summarizeFleet, connectivity-only.
  summarizeConnectivity(scope: { organizationId: string; siteId?: string }): Promise<ConnectivitySummary>;

  // Backs the MAP widget — one worst-health value per site, not per station.
  summarizeBySite(scope: { organizationId: string }): Promise<SiteHealthSummary[]>;
}
```

### OccupancySnapshotService

```
interface OccupancySnapshotService {
  // Invoked on whatever cadence a future implementation decides (see
  // CAP-X_OPERATOR_DOMAIN.md's open question on capture cadence) — writes one
  // append-only OccupancySnapshot row per call, scoped to a site.
  capture(siteId: string): Promise<OccupancySnapshot>;

  queryRange(scope: { organizationId: string; siteId?: string }, range: DateRange): Promise<OccupancySnapshot[]>;
}
```

### DashboardWidgetService

The thinnest contract, matching [CAP-X_OPERATOR_DOMAIN.md](./CAP-X_OPERATOR_DOMAIN.md)'s own assessment that `DashboardWidget` is the lowest-priority entity of the six.

```
interface DashboardWidgetService {
  listForOrganization(organizationId: string): Promise<DashboardWidget[]>;
  configure(widgetId: string, config: Record<string, unknown>): Promise<DashboardWidget>;
  reorder(organizationId: string, orderedWidgetIds: string[]): Promise<DashboardWidget[]>;
}
```

## What these contracts deliberately omit

- **No `delete` method on any service** — consistent with this schema's existing archival-over-deletion discipline (`BillingAccount.status = ARCHIVED`, never a hard delete). An `Alert`/`Incident`/`MaintenanceTicket` closed in error is corrected by reopening, not by removing the record — the same audit-trail reasoning [CAP-X_INCIDENT_FLOW.md](./CAP-X_INCIDENT_FLOW.md) already applies to `Incident.CLOSED` being terminal-but-never-erased.
- **No notification/dispatch method anywhere** — restating [CAP-X_OPERATOR_DOMAIN.md](./CAP-X_OPERATOR_DOMAIN.md)'s explicit scope boundary: these contracts create and transition records; they do not send anything to anyone.
- **No authorization/permission logic spelled out** — every method above would, in a real implementation, need the same tenant-isolation and role-based checks (`OrgContextGuard`, `MemberRole`) already enforced everywhere else in this codebase. Not repeated per-method here because it is not a new pattern this capability introduces; it is an existing one this capability must simply not violate.
