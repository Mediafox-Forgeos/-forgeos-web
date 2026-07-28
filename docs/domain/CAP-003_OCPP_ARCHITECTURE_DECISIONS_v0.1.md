# CAP-003 — OCPP Architecture Decisions v0.1

**Mission:** WO-ARGOS-006, documentation-only. **No code, schema, or dependency changes accompany this document.**
**Generated:** 2026-07-29
**Builds on:** [CAP-003 OCPP Readiness Note](./CAP-003_OCPP_READINESS_NOTE.md) (WO-ARGOS-005) — this document resolves or escalates each of that note's seven blockers.
**Related:** [CAP-002 Charging Terminology Mapping](./CAP-002_CHARGING_TERMINOLOGY_MAPPING.md), [Database Inventory](../product/MOVOS_DATABASE_INVENTORY_v1.0.md), [Product Debt Register](../product/MOVOS_PRODUCT_DEBT_REGISTER_v1.0.md)

## How to read this document

Every claim below is tagged so recommendation is never mistaken for approved fact:

| Tag                  | Meaning                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| **[FACT]**           | Directly verifiable in this repository today (schema, code, tests)                               |
| **[PROTOCOL]**       | A requirement or convention defined by the OCPP standard itself, not by this codebase            |
| **[INFERENCE]**      | A reasoned architectural conclusion drawn from facts + protocol requirements, not itself a fact  |
| **[RECOMMENDATION]** | VULCAN's proposed path — **not approved**, not to be treated as a decision until ARGOS signs off |
| **[NEEDS ARGOS]**    | A specific question that has no defensible unilateral answer and must go to ARGOS                |

No recommendation in this document authorizes implementation. Every decision explicitly states whether it blocks CAP-003 and whether ARGOS approval is required — treat "recommendation" and "decision" as different words on purpose.

---

## Decision 1 — Charging Station Network Identity

**Question:** What field identifies a `ChargingStation` at the OCPP protocol layer, and how does it relate to the entity's other identifiers?

**Current repository evidence [FACT]:** `ChargingStation` has `id` (cuid primary key), `code` (human-readable, `@@unique([siteId, code])` — unique only _within a Site_, not globally), `manufacturer`, `model`, `serialNumber`, and `protocol` (free-form version string, e.g. `"OCPP 1.6J"`, descriptive only). No field currently exists for a network/protocol connection identity. By contrast, `Evse.externalId` and `Connector.externalId` already exist for exactly this purpose at their respective tiers (`apps/movos-api/prisma/schema.prisma`).

**Constraints [PROTOCOL]:** OCPP identifies the connecting charge point via a value embedded in the WebSocket connection (commonly the URL path segment, e.g. `wss://host/ocpp/{chargePointId}`) and/or the `BootNotification` payload. This identity is established once, out of band (provisioned into the charger's configuration by whoever commissions it), and must be unique within whatever namespace the CSMS (MOVOS) exposes its WebSocket endpoint under.

**Options considered:**

1. Use `ChargingStation.id` (the cuid primary key) as the OCPP identity directly.
2. Use the existing `code` field.
3. Use `serialNumber`.
4. Add a new, dedicated field.

**Trade-offs:**

- Option 1 is explicitly forbidden by this work order and is bad practice independently: it exposes an internal database key to a physical device and to anything that can observe the connection URL (logs, proxies), and cuids carry no operational meaning for provisioning staff.
- Option 2 (`code`) is unique only _per Site_ today — two different Sites could legally have a station coded `"01"`. Reusing it as a global OCPP identity would require either a schema constraint change (site-scoped → global uniqueness, which conflicts with `code`'s existing purpose as a short human label) or a composite scheme, both of which overload one field with two different jobs.
- Option 3 (`serialNumber`) is real hardware data but is not necessarily what's configured into the device's OCPP client — vendors often provision a separate identity distinct from the physical serial, and conflating the two would break if a station is ever replaced under the same commercial installation.
- Option 4 (a new field) cleanly separates concerns: `code` stays a human label, `serialNumber` stays a hardware attribute, `id` stays internal-only, and the new field is exactly and only the OCPP connection identity.

**[RECOMMENDATION]:** Add `ChargingStation.ocppIdentity` (name not final) — `String?`, globally unique (`@@unique` across the whole table, not scoped to `siteId`), mutable. It is populated during commissioning/provisioning, distinct from `code`/`serialNumber`/`id`. Changing it must force revocation of any active connection under the old value and require re-provisioning before a new connection under the new value is accepted (this ties directly into Decision 2's provisioning/rotation model). This field belongs on `ChargingStation`, not `Evse`, because OCPP's connection-level identity is charge-point-scoped in both 1.6 and 2.0.1 — individual EVSEs are addressed _within_ one station's connection, not via separate connections each.

**ARGOS approval required:** YES — this is a schema change with security implications (a global-uniqueness identity field is effectively part of the device trust boundary).
**Blocking CAP-003:** YES — no connection-handling code can be written without knowing what field it keys off.
**Consequence if deferred:** No further OCPP transport design or implementation can proceed; every other decision in this document that references "the station's identity" depends on this one being settled first.

---

## Decision 2 — Device Authentication

**Question:** What is the minimum secure authentication mechanism for the first Kylum pilot's charging stations?

**Current repository evidence [FACT]:** MOVOS authenticates **humans** today via JWT access tokens plus an httpOnly refresh cookie (`apps/movos-api/src/auth/`). `User.passwordHash` is stored hashed, never in plaintext. Nothing in the existing auth system authenticates a non-human device; there is no precedent for API-key/secret storage anywhere in this codebase.

**Constraints [PROTOCOL]:** OCPP 1.6's most widely deployed security profile ("Security Profile 1/2") uses HTTP Basic Authentication over the WebSocket upgrade request, sent over WSS (TLS). OCPP 2.0.1 additionally defines a mutual-TLS profile ("Security Profile 3"). Neither the URL path nor the identity value itself is designed to carry a secret.

**Options considered and compared:**

| Option                                                         | Security level                                                                                                                  | Implementation complexity                                                            | Charger compatibility                                                                                                                                                               | Operational burden                                | Suitability for MVP                                                                                        | Upgrade path                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Identity-only WS path (no credential)                          | Very low — the identity string is not a secret and can leak via logs/proxies                                                    | Lowest                                                                               | Universal (baseline OCPP behavior)                                                                                                                                                  | Lowest                                            | Not recommended alone for a real pilot with a real customer                                                | N/A — must be paired with something else                                                        |
| HTTP Basic Auth over WSS                                       | Moderate — protects against casual spoofing as long as TLS is enforced; static secret risk if not rotated                       | Low–moderate — needs hashed per-station credential storage + WS-handshake validation | High — the most broadly supported "real" security tier in fielded OCPP 1.6J hardware **[INFERENCE — general OCPP industry knowledge, not verified against Kylum's specific fleet]** | Moderate — needs a provisioning/rotation workflow | Good                                                                                                       | Can be layered with IP allowlisting; later upgraded to mTLS without changing the identity model |
| Per-device secret/token (as a distinct scheme from Basic Auth) | Similar to Basic Auth if implemented as a strong, rotatable password; higher only if a real bearer/token exchange flow is built | Higher — a custom exchange flow adds real engineering surface                        | Lower — most fielded OCPP 1.6J firmware only implements the standard Basic Auth profile, not a custom bearer scheme **[INFERENCE]**                                                 | Higher                                            | Best understood as a hygiene refinement of Basic Auth (strong per-device secret), not a separate mechanism | Same as Basic Auth                                                                              |
| Mutual TLS (client certificates)                               | Highest — cryptographic device identity                                                                                         | High — needs a CA/issuance/rotation/revocation pipeline                              | Uncertain for Kylum's actual fleet — requires firmware confirmation **[NEEDS Kylum hardware info]**                                                                                 | High — full PKI lifecycle management              | Too heavy for a first pilot unless hardware is already confirmed to support it                             | This _is_ the future stronger mechanism                                                         |
| Network/IP allowlisting                                        | Defense-in-depth only, not a substitute for device auth — IPs can be shared/NATed/dynamic on cellular connections               | Low, if deployment topology allows it                                                | Depends entirely on Kylum's network setup **[NEEDS Kylum hardware/deployment info]**                                                                                                | Low, if feasible                                  | Good as an _additional_ layer for a small, known pilot fleet                                               | N/A                                                                                             |

**[RECOMMENDATION]:**

- **MVP mechanism:** WSS + HTTP Basic Auth, where the password is a strong, randomly generated, per-station secret — not a shared/global credential. Optionally layered with IP allowlisting if Kylum's fleet turns out to egress from a small, fixed set of addresses (unknown — see the Kylum hardware information request).
- **Future stronger mechanism:** Mutual TLS (OCPP 2.0.1 Security Profile 3), adopted once firmware support is confirmed and/or fleet size justifies the PKI operational cost.

**Secrets are never placed in the connection URL** — Decision 1's identity value is what appears there; the credential travels in the Basic Auth header, over TLS, per the protocol's own design.

**Provisioning, storage, rotation, revocation [RECOMMENDATION]:**

- **Provisioning:** secret generated server-side at station commissioning/re-provisioning time; shown once to the installer/operator (not retrievably stored in plaintext afterward); the charger's field configuration is updated to match.
- **Storage:** hashed at rest, following the same convention already established for `User.passwordHash` — never plaintext, never returned by any read endpoint.
- **Rotation:** an explicit, authenticated MOVOS operator action generates a new secret and immediately invalidates the old one, requiring a field re-configuration — acceptable operational overhead at pilot fleet size.
- **Revocation:** the same mechanism as rotation (or an explicit "revoked" flag), applied on decommissioning.

**ARGOS approval required:** YES — this has direct security and Kylum-pilot operational-support implications.
**Blocking CAP-003:** YES for the MVP mechanism choice. The future stronger mechanism is explicitly deferred, not blocking.
**Consequence if deferred:** No connection-handling code can safely accept a real device connection; shipping without an approved auth mechanism would mean either accepting unauthenticated device connections into a production pilot, or blocking on an undocumented ad hoc choice.

---

## Decision 3 — OCPP Version Scope

**Question:** What protocol version(s) should CAP-003 target initially?

**Current repository evidence [FACT]:** `ChargingStation.protocol` is a free-form string with `"OCPP 1.6J"` used as the schema-comment and seed-data example — descriptive metadata only; nothing in the codebase parses, validates, or branches on it. **No repository evidence exists about the actual protocol version(s) Kylum's real charger fleet speaks.** This document makes no claim about Kylum's hardware compatibility — see the [Kylum hardware information request](../product/KYLUM_OCPP_HARDWARE_INFORMATION_REQUEST.md), which must be answered before this decision can be finalized.

**Context [INFERENCE — general industry knowledge, not repository-verifiable]:** OCPP 1.6J (JSON-over-WebSocket) is, as of today, the most widely deployed version across existing installed charger fleets generally; OCPP 2.0.1 is newer, has a larger and more capable message/feature set (including native device-management and stronger security profiles), but a smaller and more variable base of mature field firmware support depending on vendor and hardware age.

**Options considered:**

1. OCPP 1.6J only.
2. OCPP 2.0.1 only.
3. Both from the start.
4. An internal protocol-agnostic adapter boundary, with exactly one concrete protocol implementation built first.

**Trade-offs:**

- Option 1: fastest time-to-production, smallest implementation-risk surface, most likely to match a pilot's existing/already-installed hardware **if** that hardware turns out to be older-generation. Con: no path to 2.x-only chargers without a second implementation later.
- Option 2: more future-proof (native stronger security profile ties into Decision 2's future mechanism), but a larger, riskier first build, and it might be entirely incompatible with Kylum's actual (unknown) fleet if that fleet predates 2.0.1 support.
- Option 3: maximizes compatibility but roughly doubles the protocol-implementation surface for a mission that hasn't yet resolved identity, auth, or transport boundary — a poor sequencing choice for a first cut.
- Option 4: builds the connection registry, message router, and command dispatcher (Decision 4) protocol-agnostically, but ships only one concrete adapter first. This keeps time-to-production and implementation risk close to Option 1 while keeping future migration cost (adding a second adapter later) low, since the transport boundary doesn't need re-architecting to add it.

**[RECOMMENDATION]:** Option 4 — protocol-agnostic internal boundary, with the first concrete adapter targeting **OCPP 1.6J**, contingent entirely on the Kylum hardware information request confirming that's what the pilot fleet actually speaks. If that request reveals 2.0.1-only hardware, the recommendation changes to a 2.0.1 first adapter instead — the abstraction choice (Option 4's shape) does not change either way.

**What Kylum must provide before this is finalized:** confirmed OCPP version(s) supported by each charger model in the pilot fleet, per the [Kylum hardware information request](../product/KYLUM_OCPP_HARDWARE_INFORMATION_REQUEST.md).

**ARGOS approval required:** YES.
**Blocking CAP-003:** YES — protocol implementation cannot start without knowing which protocol, and confirming against real hardware avoids building the wrong one.
**Consequence if deferred:** Any protocol-message code written before hardware confirmation risks being built against the wrong version entirely.

---

## Decision 4 — WebSocket Transport Boundary

**Question:** Where should the OCPP WebSocket transport live in the system's architecture?

**Current repository evidence [FACT]:** `apps/movos-api` is a single NestJS modular monolith; every capability shipped so far (Auth, Sites, CAP-002 charging CRUD) is stateless HTTP request/response. The Turborepo monorepo structure (`apps/*`, `packages/*`) already accommodates multiple sibling deployables (`movos-api`, `movos-web`, `forgeos-web`, `forge-labs`, `naming-engine` all coexist today), so adding a new app is structurally supported if warranted. **No repository evidence indicates movos-api currently runs as more than one instance** — this reflects what's visible in the repository, not a confirmed statement about the actual Railway deployment topology, which is outside this repository's visibility **[INFERENCE — absence of evidence, not evidence of absence; operational deployment configuration should be confirmed directly, not inferred from code]**.

**Options considered:** inside `movos-api`; a separate application within this monorepo; a separate deployable service sharing domain packages; an external gateway product.

**Evaluation:**

- **Stateful connection ownership:** unlike every existing endpoint, a WS gateway must hold long-lived, in-memory per-device connection state — a fundamentally different runtime profile than the current fully-stateless HTTP handlers.
- **Deployment implications:** colocated in `movos-api`, _any_ deploy of an unrelated HTTP feature (e.g. a Sites bugfix) also restarts the process and drops every live OCPP connection. Separated, HTTP deploys and OCPP-gateway deploys become independent.
- **Health checks:** a WS gateway needs a liveness signal expressing "how many devices are connected / when was the last message received," which is a different shape than the existing `/health` liveness probe.
- **Scaling:** HTTP handlers scale horizontally for free (stateless); a connection-holding gateway cannot, without first solving Decision 6 — this is a materially different scaling profile, itself an argument for eventual separation.
- **Fault isolation:** a bug or leak in new, unproven OCPP message-handling code taking down the same process serving Auth/Sites/CAP-002 CRUD is a real availability risk to already-working, unrelated product surfaces.
- **Shared authentication and database access:** colocated, the gateway trivially reuses `PrismaService`, `AuditService`, and the existing guard patterns with zero new infrastructure. Separated, it either needs its own Prisma client against the same database or an internal API/RPC boundary to the main service — real added complexity either way.
- **Operational complexity:** every additional deployable is something new to build, deploy, and monitor. For a single-pilot-customer MVP that hasn't written a line of transport code yet, that cost has to be earned, not assumed up front.

**[RECOMMENDATION]:** Build the OCPP WebSocket gateway as a **separate module inside `apps/movos-api`** initially — not a new deployable — reusing Prisma/Audit/Guards directly and accepting the deploy-coupling risk at pilot scale (a small, known device count; deploys can be scheduled to minimize disruption). Architect it internally with a clear module boundary (the connection registry and message-handling logic should not be entangled with unrelated HTTP controllers) specifically so it **can** be extracted into its own deployable later without a full rewrite. This is the smallest architecture that does not create a dead end, per the framing this decision was scoped under — full separation is Decision 6's territory, triggered by an actual scaling or fault-isolation need, not adopted preemptively.

**This decision does not authorize building it.**

**ARGOS approval required:** YES — this materially changes `movos-api`'s runtime characteristics (introduces its first stateful, long-lived-connection component).
**Blocking CAP-003:** YES.
**Consequence if deferred:** No module structure exists to build transport code into; the risk of entangling OCPP handling directly into existing HTTP controllers (making later extraction much harder) increases the longer this stays undecided.

---

## Decision 5 — Live State Write Path

**Question:** How should inbound device messages update MOVOS's persisted state, and what's the durability/write-path model?

**Current repository evidence [FACT]:** `Evse.status`/`Connector.status` are, today, written **only** by the human-facing CRUD `PATCH` endpoints CAP-002 shipped — an operator can currently mark an EVSE `AVAILABLE`/`UNAVAILABLE`/`OFFLINE` via the API. `AuditService.record()` is the existing write-provenance pattern (one relational insert per mutation), used consistently across Sites and CAP-002, but never exercised at anything resembling telemetry message frequency. No `MeterValues`/energy-telemetry table exists. No event-sourcing, event-bus, or append-only-log precedent exists anywhere in this codebase.

**Distinctions:**

- **Current live state** — what an EVSE/Connector is doing _right now_, changing at protocol-message frequency.
- **Durable business state** — the same `status` columns as a slower-changing, queryable "current believed state" that existing CRUD/list/detail UI already depends on.
- **Raw protocol event history** — every inbound/outbound OCPP message, for debugging/replay/audit, independent of whether it changed anything.
- **Telemetry** — numeric time-series readings (`MeterValues`), a distinct, larger concern.
- **Audit events** — the existing `AuditService` concept, built for human-attributable domain mutations, not device telemetry volume.

**Options considered:** direct database updates on every message; a dedicated event-ingestion layer with separate projection; an internal command/event bus; cached ephemeral state (in-memory or Redis-backed) with eventual DB sync; append-only protocol logs.

**[RECOMMENDATION]:**

- Keep `Evse.status`/`Connector.status` as the durable "current believed state" columns so existing CRUD/list/detail screens keep working unchanged — but make the write path **distinguishable**: a device-reported status change should record a different `AuditService` action (e.g. `EVSE_STATUS_REPORTED_BY_DEVICE`) than an administrative one (`EVSE_UPDATED`), even though both land in the same column. This directly addresses the "mixed administrative/telemetry write path" risk flagged in the readiness note, without new infrastructure.
- Introduce a simple **append-only raw-event log** (a new, small, dedicated table — not designed in this document, and distinct from `ChargingSession`, which this work order explicitly does not model) as the minimum viable answer to "raw protocol history." This is a materially smaller decision than a full event-sourcing system and should not be conflated with one.
- Do **not** introduce a message broker or dedicated event-bus product at this stage — unjustified for pilot-scale message volume.
- Ephemeral, in-process connection state (e.g., "is this socket currently open") is appropriate to hold only in the gateway process's memory; anything meant to be durable or visible outside that process must be written through to the database. No external cache/store (Redis etc.) is justified yet — this is consistent with Decision 6's single-instance recommendation.
- A dedicated time-series store for `MeterValues` is explicitly deferred as its own future decision, once real energy-metering/billing requirements are scoped — out of CAP-003.

**Field classification [RECOMMENDATION, based on current schema facts]:**

| Entity            | Administratively managed                                                                                  | Device-reported (once CAP-003 ships)                                                                         | Derived (never persisted)                                                                                                                                        | Historical                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `ChargingStation` | `name`, `code`, `manufacturer`, `model`, `serialNumber`, `commissionedAt`, `status` (lifecycle)           | `protocol` _could_ become device-confirmed via BootNotification — open question, not resolved here           | —                                                                                                                                                                | —                                                                         |
| `Evse`            | `name`, `maxPowerKw`, `currentType`, `phaseType`, `externalId` (operator enters this during provisioning) | `status` — today administrative (CAP-002), becomes dual-writer once CAP-003 ships (see recommendation above) | —                                                                                                                                                                | —                                                                         |
| `Connector`       | `type`, `maxPowerKw`, `externalId`                                                                        | `status` — same dual-writer transition as `Evse.status`                                                      | —                                                                                                                                                                | —                                                                         |
| _(all)_           | —                                                                                                         | —                                                                                                            | `availabilityPercent`/EVSE-and-connector counts — already computed client-side at render time per the WO-ARGOS-004 terminology mapping addendum, never persisted | _(none today — this is exactly the gap the proposed raw-event log fills)_ |

**ARGOS approval required:** YES — reinterprets the meaning of already-shipped CAP-002 fields and proposes a new table.
**Blocking CAP-003:** YES for the status dual-writer resolution. The raw-event-log table is a narrower, fast-follow-able piece, not a hard blocker to starting transport work.
**Consequence if deferred:** Device-reported and human-reported writes to the same columns become indistinguishable in the audit trail, and there's nowhere to durably record raw protocol messages for debugging a pilot integration — a real operational risk for exactly the period (first real device connections) when visibility matters most.

---

## Decision 6 — Multi-instance Connection Routing

**Question:** What is the MVP behavior if more than one OCPP transport instance ever exists?

**Current repository evidence [FACT]:** No configuration or code in this repository indicates `movos-api` runs as more than one concurrent instance today. **This reflects repository visibility, not a confirmed statement about the actual Railway deployment topology** — that should be confirmed operationally as part of approving this decision, not assumed from code alone **[INFERENCE]**.

**Options considered:** single-instance deployment for MVP; sticky sessions; a shared connection registry; Redis-backed routing; a message broker; an enforced one-instance limitation until scale requires more.

**[RECOMMENDATION]:** Enforce a **single-instance deployment constraint specifically for the OCPP transport module** (Decision 4's module), regardless of whether other, stateless parts of `movos-api` are ever scaled horizontally. At pilot scale (a small, known number of Kylum stations), one instance holding all connections in an in-process registry is sufficient, simplest, and consistent with the WO's explicit instruction not to introduce Redis or a broker without a justified current need.

**Trigger for introducing distributed routing [RECOMMENDATION]:** either (a) concurrent device-connection count or command-latency/availability requirements exceed what a single instance can reliably serve, or (b) the transport module is extracted into its own deployable (Decision 4's future path) and _that_ deployable needs to scale horizontally for availability, not just throughput. Either trigger — not fleet growth alone — is when a shared connection registry (e.g., Redis-backed) or a broker becomes justified.

**ARGOS approval required:** YES — this is a deployment-topology constraint operations must actually enforce (e.g., via replica/instance-count settings), not something code alone can guarantee.
**Blocking CAP-003:** YES, in the sense that CAP-003's code does not need to be routing-aware from day one _if_ this constraint is enforced operationally — but the constraint itself must be agreed before relying on that simplification.
**Consequence if deferred:** Building routing-aware code prematurely adds real complexity with no current justification; _not_ enforcing the single-instance constraint operationally, while building code that assumes it, risks silent command-delivery failures if a second instance is ever started without anyone realizing the assumption existed.

---

## Decision 7 — ChargingSession Boundary

**Question:** What is the minimum future `ChargingSession` concept CAP-003 needs, without creating a Prisma model yet?

**Current repository evidence [FACT]:** No `ChargingSession` model, migration, or design exists in `apps/movos-api`. The frontend has a **mock** `ChargingSession` type (`apps/movos-web/src/types/session.ts`, referenced from the M001-A Ubiquitous Language recovery) with fields `siteId, stationId, chargerId, connectorId, userId, tariffId, status, startedAt, endedAt` — real prior design thinking, but fixture-only, never connected to any backend. `RefreshSession` already establishes this schema's convention for a session-shaped entity (`id`, timestamps, status-adjacent fields) that this new entity should follow structurally, though it models something unrelated (auth, not charging).

**[PROTOCOL] context:** OCPP's "transaction" is a protocol-level concept, scoped to the lifetime of messages within one connection (`StartTransaction`/`StopTransaction` in 1.6; the equivalent transaction-event model in 2.0.1). A MOVOS `ChargingSession` is the business-level record an operator or customer cares about (history, support, eventually billing) — related to, but not guaranteed identical in scope to, one OCPP transaction.

**Conceptual definition [RECOMMENDATION — not a schema]:**

- **Session identity:** a MOVOS-internal `id` (cuid, same convention as every other entity) — distinct from any protocol transaction identifier.
- **Relation to Organization/Site/ChargingStation/EVSE/Connector:** reference the most specific real attachment point — the `Connector` — and derive the rest of the ownership chain (`Evse → ChargingStation → Site → Organization`) rather than duplicating foreign keys, consistent with the "no redundant organizationId/siteId" convention CAP-002 already established for `Evse`/`Connector`.
- **Start/stop timestamps:** `startedAt` (set) / `endedAt` (nullable until the session ends), mirroring the `RefreshSession` timestamp pattern already in the schema.
- **Energy measurements:** at minimum, a single terminal/cumulative energy value at session end. Per-interval `MeterValues` readings are a separate, larger telemetry concern (Decision 5) — CAP-003 should not need to solve that just to close a session.
- **Authorization reference:** a reference to whoever/whatever authorized the session (a User, an RFID/idTag, etc.). **[NEEDS ARGOS]** — MOVOS currently has no driver/vehicle/idTag identity concept at all (confirmed ABSENT in the M001-A domain recovery); this is a real open dependency, not an oversight to paper over.
- **Transaction/protocol identifiers:** store the OCPP transaction id as a mutable, protocol-scoped attribute — never the MOVOS primary key, exactly mirroring the `externalId` pattern already used on `Evse`/`Connector`.
- **Status:** a dedicated session-lifecycle enum (e.g. `ACTIVE`/`COMPLETED`/`FAILED`), distinct from `Evse`/`Connector` operational status, consistent with this schema's one-enum-per-entity convention.
- **Abnormal termination:** representable via status plus an optional stop-reason field — reusing OCPP's own defined stop-reason vocabulary (e.g. `EVDisconnected`, `PowerLoss`, `EmergencyStop`) rather than inventing a new one **[RECOMMENDATION]**.
- **OCPP transaction vs. MOVOS ChargingSession:** related but not assumed 1:1 — a MOVOS session is the durable business record; a transaction is a protocol-scoped event stream within it.
- **Whether one session may span protocol reconnects:** **[NEEDS ARGOS]** — the honest default recommendation is **no** for a first cut (a dropped connection ends the session; simplest, matches common CSMS default behavior), with reconnect-spanning sessions treated as a later enhancement once Decision 1's identity-on-reconnect handling is proven reliable, not a CAP-003 requirement.

**Mandatory for CAP-003 vs. later Billing/Tariff capabilities:**

- **Mandatory for CAP-003:** identity, the ownership-chain relation, start/stop timestamps, a terminal energy value, status, the protocol transaction identifier, and an abnormal-termination reason.
- **Belongs to later Tariff/Billing work, not CAP-003:** cost/pricing calculation, currency, invoice linkage, and any payment reference.

**ARGOS approval required:** YES — this defines the shape of a new domain entity, even though no schema is created by this document.
**Blocking CAP-003:** PARTIALLY — the transport/identity/auth groundwork (Decisions 1–6) does not strictly require `ChargingSession` to exist first, but `StartTransaction`/`StopTransaction` message handling has nowhere to write without it, so this blocks the "full core OCPP message" milestone specifically, not the initial connection groundwork.
**Consequence if deferred:** CAP-003 could still stand up transport, identity, and authentication without this decision, but could not process a real charging transaction end-to-end until it's resolved.

---

## Summary table

| #   | Decision                          | ARGOS approval required |                         Blocking CAP-003                          |
| --- | --------------------------------- | :---------------------: | :---------------------------------------------------------------: |
| 1   | Charging Station Network Identity |           YES           |                                YES                                |
| 2   | Device Authentication             |           YES           |                        YES (MVP mechanism)                        |
| 3   | OCPP Version Scope                |           YES           |                                YES                                |
| 4   | WebSocket Transport Boundary      |           YES           |                                YES                                |
| 5   | Live State Write Path             |           YES           |      YES (status write path); narrower for the raw-event log      |
| 6   | Multi-instance Connection Routing |           YES           |                YES (as an operational constraint)                 |
| 7   | ChargingSession Boundary          |           YES           | PARTIALLY (blocks transaction handling, not transport groundwork) |

All seven of the readiness note's blockers are addressed above — none are silently resolved as fact; every resolution proposed here is a **[RECOMMENDATION]** awaiting ARGOS approval, not an implemented or approved decision.
