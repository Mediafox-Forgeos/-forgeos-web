# CAP-006 — Remote Operations / Control Plane

**Generated:** 2026-08-20 (WO-ARGOS-064, closing WO-ARGOS-058/059)
**Implements:** WO-ARGOS-058's locked product/architecture decisions; WO-ARGOS-059's `RemoteCommand` foundation; WO-ARGOS-064's operator-facing surface.
**Builds on:** [CAP-003 OCPP Architecture Decisions](./CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md) (`ConnectionRegistryService`, `PendingCallRegistryService`), [CAP-004 Charging Sessions Foundation](./CAP-004_CHARGING_SESSIONS_FOUNDATION.md) (`SessionLifecycleService`), [CAP-005 Connectivity Engine](./CAP-005_CONNECTIVITY_ENGINE.md) (station connectivity, `ConnectivityCoordinator`).
**Does not implement:** Reset, UnlockConnector, ChangeAvailability (Phase B), an offline command queue, automatic retry-after-reconnect, synthetic/operator-issued credentials, a generic arbitrary-OCPP-command endpoint, distributed/durable timer orchestration (see §10).

This document is the implementation record for CAP-006: the seam between operator intent ("start this connector," "stop this session") and the OCPP 1.6J outbound protocol — and, just as importantly, the seam back from real device behavior into an honest, non-fabricated command outcome.

---

## 1. RemoteCommand — purpose

`RemoteCommand` (`apps/movos-api/prisma/schema.prisma`) is the authoritative, queryable lifecycle record for one operator-initiated OCPP command against one physical target (a connector, for RemoteStart; a charging session, for RemoteStop). It exists as its own entity — not folded into `AuditEvent` — because `AuditEvent`'s single-subject (`subjectType`/`subjectId`) convention doesn't fit a command that targets station+connector+session at once, and because a command has a **multi-step lifecycle**, not a single point-in-time fact.

## 2. Command lifecycle

```
REQUESTED → SENT → ACCEPTED → CONFIRMED
                  ↘ REJECTED       ↘ UNCONFIRMED
                  ↘ TIMED_OUT
```

Three layers, deliberately never collapsed (`apps/movos-api/src/ocpp/remote-commands/remote-command-state-machine.ts`):

- **REQUESTED, SENT** — transport-layer facts: did MOVOS try, did the CALL go out over the wire.
- **ACCEPTED, REJECTED, TIMED_OUT** — OCPP protocol acceptance: did the charger say yes to the CALL itself.
- **CONFIRMED, UNCONFIRMED** — real-world outcome: did the thing the command was _for_ actually happen.

`ALLOWED_TRANSITIONS` is an explicit table (`assertRemoteCommandTransitionAllowed`), the same discipline `ChargingSessionStatus` uses — an invalid transition throws rather than silently overwriting state.

## 3. ACCEPTED vs. CONFIRMED — the permanent invariant

**`REMOTE_COMMAND_ACCEPTED_IS_NOT_REAL_WORLD_CONFIRMATION`.**

An OCPP `Accepted` CALLRESULT means only "the charger will attempt it." It is never sufficient evidence, by itself, that a charging session actually started, a charger actually stopped delivering energy, or any other physical/domain outcome occurred. No command handler may ever infer `CONFIRMED` from `ACCEPTED` alone, and no command handler may fabricate:

- `Connector.status`
- `Evse.status`
- `ChargingStation.connectivityStatus`
- `ChargingSession` activation or completion

Observed OCPP behavior — a real inbound message processed through the existing, unmodified domain handlers — remains the sole authority for all of the above. This is the same three-layer discipline CAP-005 established for connectivity (administrative / observed protocol / derived operational) and CAP-004 established for session state; `RemoteCommand` is a **fourth, orthogonal concern — operator intent / control execution** — that never replaces or writes into any of the other three.

## 4. RemoteStart observed confirmation

**`REMOTE_START_CONFIRMED_ONLY_BY_OBSERVED_STARTTRANSACTION`.**

`RemoteCommandConfirmationService.onStartTransactionObserved` is called by `TransactionStartHandler` after every real inbound StartTransaction (a no-op for the overwhelming majority that have no associated command). It matches an `ACCEPTED` `REMOTE_START` `RemoteCommand` by exact `(chargingStationId, connectorId)` — unambiguous by construction, because RemoteStart's own precondition (§6) already guarantees no non-terminal `ChargingSession` existed on that connector at request time, so any session appearing afterward is provably the confirming one. On match: `ACCEPTED → CONFIRMED`, and the real session's id is persisted onto the `RemoteCommand` row (`chargingSessionId`) as durable evidence of what was confirmed.

## 5. RemoteStop observed confirmation

**`REMOTE_STOP_CONFIRMED_ONLY_BY_OBSERVED_SESSION_TERMINATION`.**

`RemoteCommandConfirmationService.onStopTransactionObserved` is called by `TransactionEndHandler` after every real inbound StopTransaction. It matches by the exact `chargingSessionId` the RemoteStop command was requested against (set at request time, never inferred). The natural-completion race — the target session finishes through the normal path while the command is still pending/accepted — is handled by an immediate check performed the moment `ACCEPTED` is reached, in addition to the event-driven path; whichever resolves first wins, and the loser's transition attempt is a caught, logged, harmless no-op (the state machine itself refuses a second `ACCEPTED→CONFIRMED`/`UNCONFIRMED` transition).

## 6. RemoteStart preconditions

All enforced server-side in `RemoteCommandService.requestCommand`, regardless of what the UI already validated:

- Station and connector exist and belong to the caller's organization (tenant ownership, resolved before anything else — see §8).
- Station has a live OCPP connection (`ConnectionRegistryService`, not just the persisted `connectivityStatus`).
- `Connector.status === 'AVAILABLE'`.
- No non-terminal `ChargingSession` already occupies the connector (`SessionLifecycleService.findNonTerminalSessionForConnector`).
- No other in-flight `RemoteCommand` for the same physical target (§9).
- The selected `AuthorizationCredential` belongs to the organization, is `ACTIVE`, and is not expired.
- The credential's identifier fits OCPP 1.6J's `CiString20Type` idTag limit.
- The connected protocol adapter actually implements RemoteStart.

## 7. RemoteStop preconditions

- The target `ChargingSession` exists and belongs to the caller's organization.
- The session is in a stoppable state: `ACTIVE`, `OFFLINE`, or `SUSPENDED` — the same set `SessionLifecycleService.stopSession`'s own transition table already treats as reachable from `STOPPING`. Never `PENDING`/`AUTHORIZED`/`STARTING` (unreachable on the synchronous 1.6J path) or any terminal status.
- Station has a live OCPP connection.
- No other in-flight `RemoteCommand` for the same target.
- The connected protocol adapter actually implements RemoteStop.
- The frontend never supplies a `protocolTransactionId` — MOVOS resolves the real session's own value server-side.

## 8. Tenant isolation

Ownership is verified via the same real DB relation-filter pattern used throughout this codebase (`getOwnedStation`/`getOwnedConnector`/`getOwnedSession`) **before** the live OCPP connection is ever resolved and **before** any `RemoteCommand` row is created. `ConnectionRegistryService` itself has zero `organizationId` awareness by design (correct for a transport-layer component) — this check is the caller's mandatory responsibility. A cross-tenant target is indistinguishable from one that doesn't exist (`NotFoundException`, never revealing existence).

## 9. Concurrency — single in-flight command per target

At most one non-terminal (`REQUESTED`/`SENT`/`ACCEPTED`) `RemoteCommand` may exist per physical target at a time, enforced at both the application layer (immediate `ConflictException`) and the database layer (`RemoteCommand_one_active_per_connector`, a partial unique index — the true race-safe backstop). Station-wide exclusion (a station-wide command blocking every connector-scoped command on that station) is **not yet built** — required before Reset or station-wide ChangeAvailability ship, not assumed to already work.

## 10. Confirmation window — a second, distinct clock

Two independent timers, never conflated:

- **Clock A** — `REMOTE_COMMAND_RESPONSE_TIMEOUT_MS` (real default 30s): `SENT → ACCEPTED/REJECTED/TIMED_OUT`. Did the charger answer the CALL at all.
- **Clock B** — `REMOTE_COMMAND_CONFIRMATION_WINDOW_MS` (real default 5 minutes, env-var configurable): `ACCEPTED → CONFIRMED/UNCONFIRMED`. Did the real-world consequence of an accepted command actually happen.

`RemoteCommand.acceptedAt` is the durable clock reference for Clock B — a separate field from `resolvedAt`, which stays `null` while `ACCEPTED` (not a terminal state).

**`REMOTE_COMMAND_CONFIRMATION_TIMERS_SINGLE_INSTANCE_LIMITATION`** — both timers are in-memory (`setTimeout`), consistent with this codebase's existing single-instance MVP constraint (`PendingCallRegistryService`, `ConnectionRegistryService`, `TransactionIdGeneratorService` all already depend on the same constraint — not a new one introduced here). A process restart mid-window loses the pending expiry; the command stays `ACCEPTED` until either the observed event still arrives (handled correctly whenever it does) or an operator/future mechanism intervenes. Acceptable for the current MVP architecture — registered here as a scalability consideration for a future multi-instance deployment, not a defect.

## 11. RBAC

RemoteStart and RemoteStop: **OWNER, ADMIN, OPERATOR** only (`@Roles`, enforced by `RolesGuard` on the backend — frontend visibility is never the security boundary). Never TECHNICIAN, SUPPORT, ANALYST, VIEWER, unless a future work order makes and records that decision explicitly.

## 12. Credential semantics

RemoteStart uses an **existing, real** `AuthorizationCredential` the operator selects from their organization's own list (`GET /credentials`) — never a synthetic/operator-issued credential, never a raw idTag string typed by the operator. The backend re-resolves and re-validates the credential id server-side (ownership, `ACTIVE` status, expiry) regardless of what the frontend already filtered.

## 13. No offline queue, no automatic retry

A station that isn't `ONLINE` per the live `ConnectionRegistryService` (not just the persisted field) fails the command immediately — `REJECTED`, not queued. A mid-flight disconnect resolves honestly via the existing timeout mechanism. No command is ever automatically retried after a timeout, a rejection, or a reconnect — a human must issue a new request.

## 14. Audit

Every real state transition (`REQUESTED`, `SENT`, `ACCEPTED`, `REJECTED`, `TIMED_OUT`, `CONFIRMED`, `UNCONFIRMED`) fires an `AuditEvent` alongside the `RemoteCommand` update — both, not either/or (`RemoteCommand` is the queryable lifecycle record; `AuditEvent` is the audit trail). Actor and organization are always present. Credential secret material is never duplicated into audit metadata.

## 15. Current OCPP 1.6J support / unsupported commands

`Ocpp16Adapter.formatOutbound`/`outboundActionName`/`parseOutboundResult` implement `RemoteStartTransaction`/`RemoteStopTransaction` only. `Reset`, `UnlockConnector`, `ChangeAvailability`, and all OCPP 2.0.1 outbound commands still throw `CapabilityNotSupportedError` — surfaced as an immediate `REJECTED` `RemoteCommand`, never a 500.

## 16. Out of scope (implementation limits, not architectural omissions)

Reset, UnlockConnector, ChangeAvailability (Phase B), an offline command queue, automatic retry-after-reconnect, a generic arbitrary-OCPP-command endpoint, distributed/durable timer orchestration for a future multi-instance deployment (§10), and resolving the `MOVOS_STARTTRANSACTION_CONCURRENCY_RETRY` follow-up — a genuine concurrent `StartTransaction` conflict (unrelated to Remote Operations specifically — it can also occur from two organic devices/retries racing `SessionLifecycleService.createSession` for the same connector) currently surfaces as an uncaught Prisma/Postgres error rather than a controlled OCPP response; the current behavior is a safe failure mode (no silent corruption), tracked as a separate, not-yet-scoped follow-up.
