# CAP-002 — Charging Terminology Mapping

**Mission:** CAP-002 — Charging Core Domain (WO-ARGOS-003)
**Generated:** 2026-07-27
**Status:** v1.0 — accompanies the CAP-002 implementation PR. Records how existing `apps/movos-web` frontend types relate to the DEC-005-approved backend domain model, and what (if anything) changes for the frontend as a result.

**Related:** [M001-A-DEC-005 resolution](./M001-A_OPEN_DECISIONS_v0.1.md#m001-a-dec-005), [M001-A Ubiquitous Language — Charging-infrastructure terms](./M001-A_UBIQUITOUS_LANGUAGE_v0.1.md#charging-infrastructure-terms)

This is not a rename of any frontend code. CAP-002 implements the backend domain and API only; no `apps/movos-web` file is touched by this PR. This document exists so a future frontend migration has a single, evidence-based reference instead of re-deriving the mapping from scratch.

---

## Summary table

| Frontend term (`apps/movos-web/src/types/`)           | Canonical backend entity (CAP-002) | Compatibility treatment                                                             | Future migration action                                                                                  |
| ----------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `Station` (`station.ts`)                              | `ChargingStation`                  | No frontend change in this PR. Types remain separate.                               | Rename frontend `Station` → `ChargingStation` (or alias-export) when the frontend consumes the real API. |
| `Charger` (`charger.ts`)                              | `Evse`                             | No frontend change in this PR. Word "Charger" stays as user-facing/commercial copy. | See [The Charger/EVSE divergence](#the-chargerevse-divergence) below — this is not a 1:1 rename.         |
| `Connector` (`connector.ts`)                          | `Connector`                        | No frontend change in this PR. Field name differs (`chargerId` vs. `evseId`).       | Rename `chargerId` → `evseId` when the frontend consumes the real API.                                   |
| "Charger" (commercial/colloquial usage, product copy) | `ChargingStation`                  | Preserved as user-facing terminology per ARGOS's ruling.                            | None required — this usage was never a typed entity to begin with.                                       |

---

## The Charger/EVSE divergence

This is the one non-obvious finding in this document and the reason it exists as more than a rename table.

ARGOS's ruling on DEC-005 states plainly: _"'Charger' must NOT become a separate persisted domain entity ... Canonical domain entity is `ChargingStation`."_ Read on its own, that sentence suggests the frontend's `Charger` type should eventually collapse into `ChargingStation`.

But the frontend's own type shapes say otherwise. `apps/movos-web/src/types/station.ts` and `charger.ts` already encode a **four-tier** hierarchy, not three:

```
Site  →  Station  →  Charger  →  Connector
```

- `Station` has `chargerCount` and `connectorCount` — it is the _container_, one level below Site.
- `Charger` has `stationId`, `vendor`, `model`, `serialNumber`, `firmwareVersion`, `ocppVersion`, a `status` enum, and an embedded `connectors: ChargerConnector[]` — it is the _independently addressable operational unit_, one level below Station and directly above Connector.

That is structurally identical to the DEC-005-approved backend hierarchy:

```
Site  →  ChargingStation  →  EVSE  →  Connector
```

`Station.chargerCount` corresponds to `ChargingStation.evses.length`. `Charger.ocppVersion` corresponds to `ChargingStation.protocol` in name only — but `Charger.status`, `Charger.maxPowerKw`, and `Charger.connectors` correspond field-for-field to `Evse.status`, `Evse.maxPowerKw`, and `Evse.connectors`. The backend schema comment for `EvseStatus` in `apps/movos-api/prisma/schema.prisma` records this explicitly: its value set was reused directly from the frontend's `ChargerStatus`.

**Conclusion:** two different things are named "Charger" in this codebase, and they map to two different backend entities:

1. **Colloquial/commercial "charger"** (product copy, sales language, "how many chargers are installed at this site") — refers to the whole physical unit a technician bolts to a wall or pedestal. This maps to `ChargingStation`, matching ARGOS's ruling.
2. **The frontend TypeScript type `Charger`** — structurally, by its fields and its position between `Station` and `Connector`, maps to `Evse`, not `ChargingStation`.

This is intentional divergence, not an error in either the frontend types or the backend schema, and it is documented here rather than silently resolved, per the WO's instruction. It has one concrete consequence for the eventual frontend migration: renaming the TypeScript type `Charger` to `ChargingStation` (a naive reading of ARGOS's ruling) would be **wrong** — it would collide with the already-distinct `Station` type and misrepresent the tier the type actually models. The correct eventual rename is `Charger` → `Evse` (or a UI-facing alias that keeps displaying the word "Charger" to users while the underlying type name changes), with `Station` → `ChargingStation` handling the other tier.

No such rename is performed in this PR. CAP-002 is backend-only.

---

## Field-level notes

### Station → ChargingStation

`Station`'s `chargerCount`, `connectorCount`, and `availabilityPercent` are **computed/aggregate** fields in the frontend mock data. CAP-002's `ChargingStation` Prisma model stores none of these — they would need to be derived (via a query or a future read-model) from the related `Evse`/`Connector` rows. This PR's `GET` endpoints return the raw `ChargingStation` record; they do not compute these aggregates. Deferred, not forgotten.

### Charger → Evse

| Frontend `Charger` field | Backend `Evse` field                 | Note                                                                                                                             |
| ------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `vendor`                 | _(not modeled)_                      | Lives on `ChargingStation.manufacturer` instead — the physical unit, not the EVSE, has a manufacturer in the approved hierarchy. |
| `model`                  | _(not modeled)_                      | Same as above — lives on `ChargingStation.model`.                                                                                |
| `serialNumber`           | _(not modeled)_                      | Same as above — lives on `ChargingStation.serialNumber`.                                                                         |
| `firmwareVersion`        | _(not modeled)_                      | No CAP-002 field. Out of scope — no present CRUD use case demonstrated; would be added when OCPP integration needs it.           |
| `ocppVersion`            | `ChargingStation.protocol`           | Free-form string, not enum, at the `ChargingStation` tier — not per-EVSE.                                                        |
| `status`                 | `Evse.status`                        | Same 7-value set (`AVAILABLE/CHARGING/OCCUPIED/RESERVED/UNAVAILABLE/FAULTED/OFFLINE`), reused exactly.                           |
| `maxPowerKw`             | `Evse.maxPowerKw`                    | Direct match.                                                                                                                    |
| `connectors`             | `Evse.connectors` (relation)         | Direct match, as a real relation instead of an embedded array.                                                                   |
| `lastHeartbeat`          | _(not modeled)_                      | Deferred to the OCPP capability — CAP-002 has no live protocol connection to produce a heartbeat from.                           |
| —                        | `Evse.externalId`                    | New. Protocol/hardware identifier (e.g. an OCPP `evseId`), explicitly not the primary key. No frontend equivalent existed.       |
| —                        | `Evse.currentType`, `Evse.phaseType` | New. Not present in the frontend type at all — added from the WO's data-model guidance, not from frontend evidence.              |

### Connector → Connector

| Frontend `Connector` field | Backend `Connector` field | Note                                                                                                                                             |
| -------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `chargerId`                | `Connector.evseId`        | Renamed to match the approved parent tier (EVSE, not Charger).                                                                                   |
| `label`                    | _(not modeled)_           | No CAP-002 equivalent. `externalId` serves a related but distinct purpose (protocol identifier, not a display label).                            |
| `type`                     | `Connector.type`          | Same values, casing normalized: frontend `'Type2'`/`'CHAdeMO'` → backend `TYPE2`/`CHADEMO` (Prisma enum members are conventionally upper-snake). |
| `maxPowerKw`               | `Connector.maxPowerKw`    | Direct match.                                                                                                                                    |
| `status`                   | `Connector.status`        | Same 7-value set as `Evse.status`, kept as a separate enum per this schema's one-enum-per-entity convention.                                     |
| `activeSessionId`          | _(not modeled)_           | Deferred — `ChargingSession` is explicitly out of CAP-002's scope.                                                                               |
| `lastUpdate`               | `Connector.updatedAt`     | Prisma's standard `@updatedAt` timestamp serves the same purpose.                                                                                |
| —                          | `Connector.externalId`    | New. Protocol/hardware identifier (e.g. an OCPP `connectorId`). No frontend equivalent existed.                                                  |

---

## What this PR does not do

- Does not modify any file under `apps/movos-web`.
- Does not rename any frontend type, route, or user-facing copy.
- Does not remove or deprecate the word "Charger" from product/UI language — DEC-005 explicitly preserves it as commercial terminology.
- Does not implement `chargerCount`/`connectorCount`/`availabilityPercent` aggregates, OCPP fields (`firmwareVersion`, `lastHeartbeat`), or session linkage (`activeSessionId`) — all deferred to later capabilities.
