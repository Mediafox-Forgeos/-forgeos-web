# OCPP ↔ Domain Mapping Guide (CAP-004)

**Generated:** 2026-07-31 (WO-ARGOS-009)
**Code:** `apps/movos-api/src/ocpp/handlers/{authorization,transaction-start,transaction-update,transaction-end}.handler.ts`
**Architecture:** [CAP-004 §9–§10](../domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md#9-ocpp-16j-mapping-implemented)
**Companion to:** [OCPP/Domain Status Mapping](./OCPP_DOMAIN_STATUS_MAPPING.md) (CAP-003's Boot/Heartbeat/Status mapping — this document covers CAP-004's Authorize/Transaction* mapping instead)

## OCPP 1.6J — implemented

| OCPP message                       | Normalized event    | Handler                    | Domain effect                                                                                                                               |
| ---------------------------------- | ------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `Authorize`                        | `Authorization`     | `AuthorizationHandler`     | Creates exactly one `AuthorizationAttempt`. No session (DEC-014).                                                                           |
| `StartTransaction`                 | `TransactionStart`  | `TransactionStartHandler`  | Records an `AuthorizationAttempt`; if `ACCEPTED`/`OFFLINE_ACCEPTED`, calls `SessionLifecycleService.createSession()`. Otherwise no session. |
| `MeterValues` (transaction-scoped) | `TransactionUpdate` | `TransactionUpdateHandler` | Appends a `MeterValue` via `MeterValuesService`, which also advances `ChargingSession.energyWh`.                                            |
| `StopTransaction`                  | `TransactionEnd`    | `TransactionEndHandler`    | Calls `SessionLifecycleService.stopSession()` with a mapped termination reason. Idempotent on an already-terminal session.                  |

`MeterValues` sent with **no** `transactionId` (periodic, non-transaction telemetry) resolves to `UnsupportedMessage` at the adapter level — never reaches `TransactionUpdateHandler`. `MeterValue.sessionId` is required in the schema; there is nowhere for that telemetry to attach.

## Response encoding — a deliberate departure from Boot/Heartbeat/Status

CAP-003's `formatResponse()` treats any non-`Accepted` `DomainResult` as a protocol-level `CALLERROR`. That's wrong for `Authorize`/`StartTransaction`: OCPP encodes "this idTag isn't valid" as a normal `CALLRESULT` carrying `idTagInfo.status = Invalid/Blocked/Expired`, not as an error. `Ocpp16Adapter.formatResponse()` special-cases `Authorization`/`TransactionStart`/`TransactionUpdate`/`TransactionEnd` to bypass the CALLERROR shortcut — see the code comment at the top of that method.

`DomainResult.payload` is how handlers communicate protocol-specific response data upward: `idTagStatus` (both `Authorization` and `TransactionStart`), `protocolTransactionId` and `sessionId` (`TransactionStart` only, on acceptance).

## Termination reason mapping

See [CAP-004 §6](../domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md#6-session-termination-model-dec-015) for the full table and rationale for each collapsed case. Implemented in `src/ocpp/normalization/termination-reason-mapping.ts`. The raw OCPP `reason` string is never discarded — it remains in the corresponding `OcppProtocolEvent.payload` row regardless of classification.

## idTagInfo.status mapping

Implemented in `src/ocpp/normalization/id-tag-status-mapping.ts`, shared by `AuthorizationHandler` and `TransactionStartHandler` (both build a response carrying `idTagInfo`).

## OCPP 2.0.1 — documentation only

| OCPP 2.0.1 message                     | Normalized event    | Domain effect (once built)         |
| -------------------------------------- | ------------------- | ---------------------------------- |
| `Authorize`                            | `Authorization`     | Same as 1.6J.                      |
| `TransactionEvent(eventType: Started)` | `TransactionStart`  | Same as 1.6J's `StartTransaction`. |
| `TransactionEvent(eventType: Updated)` | `TransactionUpdate` | Same as 1.6J's `MeterValues`.      |
| `TransactionEvent(eventType: Ended)`   | `TransactionEnd`    | Same as 1.6J's `StopTransaction`.  |

**Not implemented.** `Ocpp201Adapter` remains the boundary-only stub CAP-003 shipped — every 2.0.1 message, including `Authorize`/`TransactionEvent`, still resolves to an explicit `CapabilityNotSupportedError`/`CALLERROR`. The normalized event shapes above are shared with 1.6J specifically so a future 2.0.1 adapter needs no domain-layer changes — only a new adapter that produces the same events.

## Related guides

[Charging Session Guide](./CHARGING_SESSION_GUIDE.md) · [Authorization Guide](./AUTHORIZATION_GUIDE.md) · [Session Lifecycle Guide](./SESSION_LIFECYCLE_GUIDE.md) · [OCPP Engine Guide](./OCPP_ENGINE_GUIDE.md)
