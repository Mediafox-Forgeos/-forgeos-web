# CAP-003 — OCPP Readiness Note

**Mission:** Pre-implementation note only (WO-ARGOS-005). **Not an implementation.** No OCPP code, library, or architecture is introduced by this document or by the PR it accompanies.
**Generated:** 2026-07-28
**Related:** [CAP-002 Charging Terminology Mapping](./CAP-002_CHARGING_TERMINOLOGY_MAPPING.md), [Database Inventory](../product/MOVOS_DATABASE_INVENTORY_v1.0.md), [Implementation Roadmap](../product/MOVOS_IMPLEMENTATION_ROADMAP_v1.0.md)

Purpose: a concise decision checklist for whoever starts CAP-003, so that mission doesn't have to re-derive "what does CAP-002 already give us, and what's still an open question" from scratch. This is deliberately short — a readiness check, not a design document.

---

## 1. Model readiness — what CAP-002 already gives CAP-003

| Entity            | Ready for OCPP? | Notes                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChargingStation` | Partially       | Has `protocol` (free-form version string, e.g. `"OCPP 1.6J"`) and `status` (administrative lifecycle only — DRAFT/ACTIVE/INACTIVE/ARCHIVED, not operational/connection state). **Has no protocol/network identity field** — see Blocker 1.                                                                                                        |
| `Evse`            | Partially       | Has `externalId` (protocol identifier, e.g. an OCPP 2.x `evseId`) and `status` (7-value operational enum: AVAILABLE/CHARGING/OCCUPIED/RESERVED/UNAVAILABLE/FAULTED/OFFLINE). CAP-002 CRUD only ever writes AVAILABLE/UNAVAILABLE/OFFLINE — the other four values exist in the enum but nothing sets them yet. No field for "last seen"/heartbeat. |
| `Connector`       | Partially       | Has `externalId` (protocol identifier, e.g. an OCPP `connectorId`) and the same 7-value `status` enum as `Evse`. No field for an active session/transaction reference.                                                                                                                                                                            |
| `ChargingSession` | Does not exist  | Required for OCPP `StartTransaction`/`StopTransaction` mapping. Zero schema, zero prior design work beyond the frontend's mock `ChargingSession` type.                                                                                                                                                                                            |

## 2. Protocol identifiers already available

- `Evse.externalId` — hardware/protocol identifier (e.g. an OCPP 2.x `evseId`), nullable, mutable, explicitly **not** the primary key. Unique per `chargingStationId`.
- `Connector.externalId` — same pattern, unique per `evseId`.
- `ChargingStation.protocol` — a free-form string recording the protocol/version the station speaks (e.g. `"OCPP 1.6J"`). This is descriptive metadata, not a connection identifier.
- `ChargingStation.serialNumber` — a real hardware serial number. Not designed as a network identity, but is the closest existing candidate if one is needed before Blocker 1 is resolved.

## 3. Fields intentionally deferred from CAP-002

Recorded in detail in the [Terminology Mapping's field-level notes](./CAP-002_CHARGING_TERMINOLOGY_MAPPING.md#field-level-notes); summarized here for OCPP relevance:

- `firmwareVersion` (frontend `Charger.firmwareVersion`) — not modeled anywhere. Needed if CAP-003 wants to track/report firmware over OCPP.
- `lastHeartbeat` / any "last seen" timestamp — not modeled on `Evse` or `ChargingStation`. Required for connection-liveness UI and for detecting silently-dropped WebSocket connections.
- `activeSessionId` (frontend `Connector.activeSessionId`) — not modeled. Blocked on `ChargingSession` not existing yet.
- Full OCPP status vocabulary — `EvseStatus`/`ConnectorStatus` reuse the frontend's pre-existing 7-value set, which is a reasonable starting point but has not been checked against the actual OCPP 1.6/2.x status-enum vocabularies (e.g. OCPP 1.6's `ChargePointStatus` has finer-grained values like `Preparing`, `SuspendedEV`, `SuspendedEVSE`, `Finishing` that don't map 1:1 onto the current 7 values).

## 4. Required OCPP transport components (not yet built, not yet chosen)

None of the following exist in `apps/movos-api` today — everything shipped so far (Sites, CAP-002) is stateless HTTP request/response:

- A persistent-connection transport layer (WebSocket server) — no library, framework integration, or gateway pattern has been selected.
- A connection registry mapping a live socket to a `ChargingStation` (and, once connected, to its `Evse`/`Connector` children).
- An inbound message router/dispatcher for OCPP action types (BootNotification, Heartbeat, StatusNotification, MeterValues, StartTransaction, StopTransaction, etc.).
- An outbound command dispatcher (MOVOS → station) with request/response correlation (OCPP's `messageId` matching), needed for anything beyond passive listening.
- Message (de)serialization and schema validation appropriate to whichever OCPP version(s) are actually supported — see Blocker 6.

## 5. WebSocket and connection-lifecycle considerations

- **Identity at connect time:** OCPP typically identifies the connecting charge point via the WebSocket URL path (e.g. `wss://.../ocpp/{chargePointId}`) or via the first `BootNotification` payload. Neither has a clear field to bind to yet — see Blocker 1.
- **Reconnect/backoff behavior:** stations disconnect and reconnect on real networks (cellular modems, power cycling). No decision has been made on how a reconnect is distinguished from a genuinely new station, or how quickly a dropped connection should flip an `Evse`'s status toward `OFFLINE`.
- **Concurrency scope:** one connection per `ChargingStation`, or per `Evse`? OCPP 1.6 speaks at the charge-point (station) level; OCPP 2.x has more granular EVSE-level addressing within a single connection. This affects the connection registry's shape and is downstream of Blocker 6 (version scope).
- **Multiple MOVOS API instances:** if `apps/movos-api` ever runs more than one instance, a station's live WebSocket connection is pinned to whichever instance accepted it — any other instance needs a way to route a command to the right one. No such mechanism exists or has been designed.

## 6. Device authentication — decision required

MOVOS currently authenticates **humans** (JWT access tokens + httpOnly refresh cookies, `apps/movos-api/src/auth/`). Nothing in that system maps directly onto authenticating a **charge point**. Real options exist (HTTP Basic Auth over WSS with per-station credentials — OCPP 1.6's common pattern; mutual TLS client certificates; a station-specific signed token) but **none has been evaluated or chosen**. This has security implications (a compromised or spoofed station could inject fake telemetry or, worse, fake command acknowledgments) and should not be decided as a side effect of writing transport code — it needs its own review.

## 7. Command-routing considerations

- How does a future "remote start/stop" or "unlock connector" action (issued from the MOVOS UI or API) find the specific live connection serving a given `Evse`/`Connector`? This depends on the connection registry (§5) and, if multiple API instances are ever in play, on some cross-instance routing/broker mechanism — undesigned.
- What happens if a command is issued while the target station is offline? No queuing/expiry/retry policy has been considered.
- Command authorization: which `MemberRole`s can issue device commands, and does that reuse the existing `@Roles()`/`RolesGuard` pattern or need something new (e.g. a command needs to survive a WebSocket-layer check, not just an HTTP-request-layer guard)? Undecided.

## 8. Live-state and telemetry persistence questions

- **Where does live status get written?** Directly into `Evse.status`/`Connector.status` (the same columns CAP-002's CRUD `PATCH` endpoints write to), or into a separate, higher-write-volume live-state store, with the Prisma columns only periodically synced or left administrative-only? Mixing a human-editable administrative field with a high-frequency telemetry write path in the same column is a real design risk (e.g. a station's `StatusNotification` arriving mid-way through an operator's manual edit) that CAP-002 explicitly did not need to resolve, but CAP-003 will.
- **MeterValues / energy telemetry:** no storage strategy exists — not a table, not a time-series decision, not even a stub. This is a substantial sub-decision of its own, likely deserving its own document once CAP-003 is scoped.
- **Heartbeat / liveness:** no `lastHeartbeat`/`lastSeenAt` field exists on any entity (§3). Needed before "is this station actually online right now" can be answered reliably in the UI.

## 9. Exact blockers before CAP-003 implementation can start

1. **No protocol/network identity field exists on `ChargingStation`.** Something has to answer "which `ChargingStation` row does this incoming WebSocket connection belong to?" — needs a schema decision (new field, or repurpose `serialNumber`/`code`) before any connection-handling code is written.
2. **No decision on where live status writes land** (§8) — same-column-as-CRUD vs. a separate live-state path.
3. **No device authentication mechanism chosen** (§6) — a security review, not an engineering default.
4. **No WebSocket transport exists in `apps/movos-api`** — this is new infrastructure for the codebase, not an extension of the existing HTTP-only pattern.
5. **No decision on multi-instance command/connection routing** (§5, §7) — relevant even if MOVOS runs a single instance today, since it affects how hard a later scale-out would be to retrofit.
6. **No decision on OCPP version scope** — 1.6J only, 2.0.1 only, or both? `ChargingStation.protocol` being a free string suggests mixed-fleet support was anticipated, but nothing enforces, branches on, or has even inventoried the practical differences (message formats, status vocabularies, connection-identity conventions differ meaningfully between 1.6 and 2.x).
7. **`ChargingSession` does not exist.** OCPP's `StartTransaction`/`StopTransaction` need somewhere to land; this is likely its own prerequisite mission rather than something CAP-003 should absorb silently.

None of these are resolved by this note. They are the explicit set of decisions ARGOS (or whoever scopes CAP-003) needs to make before implementation begins — deliberately left open rather than defaulted.
