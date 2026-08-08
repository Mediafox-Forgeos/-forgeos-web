# Operational Vocabulary

**Work order:** WO-ARGOS-023 (Operational Consistency Hardening)
**Status:** CANONICAL. This document defines the one correct Spanish label and visual tone for every real, backend-driven status value MOVOS shows an operator. Where code and this document disagree, the code has a bug — file it against whichever screen diverged, don't "fix" this document to match the screen.
**Origin:** every entry below already existed in code before this work order, scattered across independently-hardcoded strings in different components. [OPERATOR_USABILITY_REVIEW.md](./OPERATOR_USABILITY_REVIEW.md) found the same underlying value (`ConnectivityStatus.OFFLINE`) rendered as two different words on two different real screens — this document is the fix: one source, reused, not restated.

## Principle

**One enum value → one label → one place it's defined → every screen imports it.** The canonical source is `apps/movos-web/src/components/movos/api-charging-status-badges.tsx` — every `Api*StatusBadge` component and exported label constant in that file is the single source of truth for its enum. No component anywhere else in the app should hardcode a status label as a string literal; it should import the badge component or, where the layout needs the word without the badge chrome (an icon-grid widget, say), import the label constant.

This is not a new convention — `api-charging-status-badges.tsx` already existed, with this exact intent stated in its own header comment, before this work order. What was missing was enforcement: the CAP-X operator dashboard (Sprint 1, WO-ARGOS-022) was built without reusing it, and independently reinvented a subset of the same words, incorrectly, for one value.

## The canonical tables

### `ChargingStationStatus` (administrative — CAP-002)

| Value      | Label     | Tone    |
| ---------- | --------- | ------- |
| `DRAFT`    | Borrador  | neutral |
| `ACTIVE`   | Activo    | success |
| `INACTIVE` | Inactivo  | warning |
| `ARCHIVED` | Archivado | muted   |

Source: `ApiChargingStationStatusBadge`.

### `EvseStatus` / `ConnectorStatus` (operational — CAP-002/CAP-003, one shared map)

| Value         | Label          | Tone    |
| ------------- | -------------- | ------- |
| `AVAILABLE`   | Disponible     | success |
| `CHARGING`    | Cargando       | info    |
| `OCCUPIED`    | Ocupado        | info    |
| `RESERVED`    | Reservado      | warning |
| `UNAVAILABLE` | No disponible  | neutral |
| `FAULTED`     | Con falla      | danger  |
| `OFFLINE`     | Fuera de línea | muted   |

Source: `ApiEvseStatusBadge` / `ApiConnectorStatusBadge` (`operationalStatusMap`).

### `ConnectivityStatus` (device network link — CAP-005)

| Value     | Label        | Tone    |
| --------- | ------------ | ------- |
| `ONLINE`  | En línea     | success |
| `OFFLINE` | Desconectado | danger  |
| `UNKNOWN` | Desconocido  | neutral |

Source: `ApiConnectivityStatusBadge`, label constant `CONNECTIVITY_STATUS_LABELS`.

### `ChargingSessionStatus` (business — CAP-004/CAP-005, 10 values)

| Value        | Label        | Tone    |
| ------------ | ------------ | ------- |
| `PENDING`    | Pendiente    | neutral |
| `AUTHORIZED` | Autorizada   | neutral |
| `STARTING`   | Iniciando    | info    |
| `ACTIVE`     | Activa       | info    |
| `SUSPENDED`  | Suspendida   | warning |
| `OFFLINE`    | Sin conexión | danger  |
| `STOPPING`   | Deteniendo   | warning |
| `COMPLETED`  | Completada   | success |
| `FAILED`     | Fallida      | danger  |
| `CANCELLED`  | Cancelada    | muted   |

Source: `ApiChargingSessionStatusBadge` — added by this work order; before it, no component could render all 10 real values (the legacy mock `SessionStatusBadge` in `status-badge.tsx` only knows a 5-value fictional enum that doesn't match `ChargingSessionStatus` at all).

### `StationHealthStatus` (computed, non-persisted — CAP-X Sprint 1)

| Value      | Label        | Tone    | Word source                                     |
| ---------- | ------------ | ------- | ----------------------------------------------- |
| `healthy`  | Saludable    | success | Own word — no connectivity equivalent           |
| `degraded` | Degradado    | warning | Own word — no connectivity equivalent           |
| `offline`  | Desconectado | danger  | **Reuses `CONNECTIVITY_STATUS_LABELS.OFFLINE`** |
| `unknown`  | Desconocido  | muted   | **Reuses `CONNECTIVITY_STATUS_LABELS.UNKNOWN`** |

Source: `StationHealthBadge`. Count-label plural variants (used in the fleet-wide summary widget, not a single-station badge): Saludables / Degradadas / Desconectadas / Desconocidas.

## Two deliberate rules, not oversights

### Rule 1 — `StationHealthStatus.offline`/`.unknown` share their word with `ConnectivityStatus.OFFLINE`/`.UNKNOWN`

Per [CAP-X_STATION_HEALTH.md](../domain/CAP-X_STATION_HEALTH.md)'s precedence rules, a station's computed `offline`/`unknown` health state is _entirely_ driven by its raw `ConnectivityStatus` in Sprint 1 — there is no independent fact being summarized, just a rename. Using the same word in both places tells an operator, correctly, that these are the same underlying observation seen from two altitudes (a single station's card vs. a fleet rollup), not two different problems. This was fixed by this work order — before it, `StationHealthBadge` said "Fuera de línea" for the same condition `ApiConnectivityStatusBadge` called "Desconectado."

### Rule 2 — `ConnectorStatus`/`EvseStatus.OFFLINE` keeps its own, different word ("Fuera de línea"), deliberately not unified with `ConnectivityStatus.OFFLINE` ("Desconectado")

These are genuinely different facts, and collapsing them to one word would hide that: a station's `ConnectivityStatus` describes whether its WebSocket link to MOVOS is currently verified reachable; a `Connector`'s or `Evse`'s `status` describes device-reported operational state, which the OCPP engine can set to `OFFLINE` independent of the station's own connectivity (a specific connector reporting itself out of service while the station's link to MOVOS is otherwise fine). Using the same Spanish word for both would suggest one caused the other, which isn't always true. This distinction predates this work order (present in `api-charging-status-badges.tsx`'s original comments) and this document keeps it, explicitly, so a future pass doesn't "fix" it into an actual inconsistency by unifying two words that are correctly describing two different things.

## What this document does not cover, and why

- **`Alert`/`Incident`/`MaintenanceTicket` vocabulary** — none of these exist as real entities yet (Sprint 2, explicitly out of scope for this work order's constraints: "No Alert. No Incident. No MaintenanceTicket."). [CAP-X_OPERATOR_DOMAIN.md](../domain/CAP-X_OPERATOR_DOMAIN.md) already proposes their conceptual labels; this document will absorb them once they're real.
- **The legacy mock badges in `status-badge.tsx`** (`StationStatusBadge`, `ChargerStatusBadge`, `ConnectorStatusBadge`, `SessionStatusBadge`, `AlertSeverityBadge`, `AlertStatusBadge`, `SiteStatusBadge`, `UserStatusBadge`) — these back the still-unmigrated `/chargers`, `/connectors`, `/tariffs`, `/users`, `/alerts` pages, none of which this work order's objectives named. They remain deliberately unconverted; [OPERATIONAL_CONSISTENCY_REPORT.md](./OPERATIONAL_CONSISTENCY_REPORT.md) states this explicitly rather than silently leaving it implicit.
- **Revenue/currency formatting** — governed by `formatCurrency`/`tenant.currency` in `lib/format.ts`, an orthogonal concern to status vocabulary.

## Governance

Any future screen that displays one of the five status dimensions above must import from `api-charging-status-badges.tsx` — either the badge component directly, or (for a layout that can't use the badge's chrome, like an icon-grid widget) an exported label constant, following `CONNECTIVITY_STATUS_LABELS`'s precedent. A new independently-hardcoded status string for an already-covered enum is exactly the mistake this work order fixed, and should be treated as a bug at review time, not a style preference.
