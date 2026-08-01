# Session Lifecycle Guide

**Generated:** 2026-07-31 (WO-ARGOS-009)
**Code:** `apps/movos-api/src/sessions/session-lifecycle.service.ts`
**Architecture:** [CAP-004 §8](../domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md#8-session-lifecycle)

`SessionLifecycleService` is the **only** writer for `ChargingSession` — no other service, controller, or handler mutates the table directly.

## State diagram

```
PENDING
   ↓
AUTHORIZED
   ↓
STARTING
   ↓
ACTIVE  ──────┬──────────┬─────────────┐
   │          │          │             │
STOPPING   OFFLINE     FAILED      CANCELLED
   ↓          │
COMPLETED   (resume) → ACTIVE
```

`SUSPENDED` shares `OFFLINE`'s transition rules (both mean "logically active, not delivering energy" — distinguished by cause, not by allowed moves).

## The allowed-transitions table (`ALLOWED_TRANSITIONS`)

| From         | To                                                        |
| ------------ | --------------------------------------------------------- |
| `PENDING`    | `AUTHORIZED`, `CANCELLED`, `FAILED`                       |
| `AUTHORIZED` | `STARTING`, `CANCELLED`, `FAILED`                         |
| `STARTING`   | `ACTIVE`, `FAILED`, `CANCELLED`                           |
| `ACTIVE`     | `STOPPING`, `OFFLINE`, `SUSPENDED`, `FAILED`, `CANCELLED` |
| `OFFLINE`    | `ACTIVE`, `SUSPENDED`, `FAILED`, `STOPPING`, `CANCELLED`  |
| `SUSPENDED`  | `ACTIVE`, `OFFLINE`, `FAILED`, `STOPPING`, `CANCELLED`    |
| `STOPPING`   | `COMPLETED`, `FAILED`                                     |
| `COMPLETED`  | _(terminal)_                                              |
| `FAILED`     | _(terminal)_                                              |
| `CANCELLED`  | _(terminal)_                                              |

Exported as `ALLOWED_TRANSITIONS` from `session-lifecycle.service.ts` — importable directly for any code that needs to reason about valid transitions without duplicating the table.

## Method reference

| Method                                 | Transition                                           | Notes                                                                                                                                                                                                                                                                                                                |
| -------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSession(input)`                 | _(insert)_ → `ACTIVE`                                | The only entry point that inserts a row. Collapses `PENDING→AUTHORIZED→STARTING→ACTIVE` into one insert for the 1.6J happy path — see "Why one insert, not four writes" below. Idempotent by connector, not by transaction id (see [CAP-004 §13](../domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md#13-idempotency)). |
| `activateSession(id)`                  | `STARTING → ACTIVE`                                  | Not used by the 1.6J synchronous path; reserved for a future RemoteStart flow where activation is a separate step.                                                                                                                                                                                                   |
| `suspendSession(id, target?)`          | `ACTIVE → SUSPENDED` (default) or `ACTIVE → OFFLINE` | The caller decides which — device-reported suspension vs. connection loss.                                                                                                                                                                                                                                           |
| `resumeSession(id)`                    | `OFFLINE\|SUSPENDED → ACTIVE`                        |                                                                                                                                                                                                                                                                                                                      |
| `stopSession(id, {meterStop, reason})` | `→ STOPPING → COMPLETED`                             | Finalizes `energyWh`, `meterStop`, `endedAt`. Refusing to re-terminate an already-terminal session ("cannot finish twice") is a direct consequence of `COMPLETED`/`FAILED`/`CANCELLED` having no outgoing transitions — not a separate check.                                                                        |
| `failSession(id, reason)`              | any non-terminal `→ FAILED`                          |                                                                                                                                                                                                                                                                                                                      |
| `cancelSession(id, reason?)`           | any non-terminal `→ CANCELLED`                       | Defaults `reason` to `USER_CANCELLED`.                                                                                                                                                                                                                                                                               |
| `updateEnergy(id, energyWh)`           | _(no status change)_                                 | Called by `MeterValuesService`, never invents a transition itself; refuses on a terminal session.                                                                                                                                                                                                                    |

## Why one insert, not four writes

`createSession()` doesn't literally perform 4 sequential `UPDATE`s to walk `PENDING→AUTHORIZED→STARTING→ACTIVE` — it's a single `INSERT` landing directly on `ACTIVE`. This is safe because: (1) OCPP 1.6J's `StartTransaction` already implies a validated, physically-connecting device — there is no real intermediate state to observe; (2) no other process ever reads the row mid-walk within one handler invocation. The transition table itself is still the source of truth for whether this walk is _valid_ — proven directly in `session-lifecycle.service.spec.ts`'s "the transition table itself" describe block, not just asserted in a comment.

## Related guides

[Charging Session Guide](./CHARGING_SESSION_GUIDE.md) · [Authorization Guide](./AUTHORIZATION_GUIDE.md) · [OCPP Mapping Guide](./OCPP_MAPPING_GUIDE.md)
