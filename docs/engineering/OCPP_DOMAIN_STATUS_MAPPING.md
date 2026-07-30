# OCPP / Domain Status Mapping

**Generated:** 2026-07-30 (WO-ARGOS-007)
**Code:** `apps/movos-api/src/ocpp/normalization/status-mapping.ts`
**Part of:** [OCPP Engine Guide](./OCPP_ENGINE_GUIDE.md)

## The mapping

| OCPP 1.6J `ChargePointStatus`                     | `NormalizedDeviceStatus` | `EvseStatus` / `ConnectorStatus` |
| ------------------------------------------------- | ------------------------ | -------------------------------- |
| `Available`                                       | `AVAILABLE`              | `AVAILABLE`                      |
| `Preparing`                                       | `PREPARING`              | `OCCUPIED`                       |
| `Charging`                                        | `CHARGING`               | `CHARGING`                       |
| `SuspendedEVSE`                                   | `SUSPENDED_EVSE`         | `OCCUPIED`                       |
| `SuspendedEV`                                     | `SUSPENDED_EV`           | `OCCUPIED`                       |
| `Finishing`                                       | `FINISHING`              | `OCCUPIED`                       |
| `Reserved`                                        | `RESERVED`               | `RESERVED`                       |
| `Unavailable`                                     | `UNAVAILABLE`            | `UNAVAILABLE`                    |
| `Faulted`                                         | `FAULTED`                | `FAULTED`                        |
| _(connection-layer inference, not an OCPP value)_ | `OFFLINE`                | `OFFLINE`                        |

## Why this is lossy, and why that's the right call

`EvseStatus`/`ConnectorStatus` (CAP-002) are a 7-value enum; OCPP 1.6J's `ChargePointStatus` has 9 meaningful values (10 counting `OFFLINE`, which isn't even a protocol status — it's inferred from connection loss). Four protocol values (`Preparing`, `SuspendedEVSE`, `SuspendedEV`, `Finishing`) all collapse onto `OCCUPIED`.

This was a deliberate choice, not an oversight — the [CAP-003 Readiness Note](../domain/CAP-003_OCPP_READINESS_NOTE.md) flagged this exact mismatch as an open question. The resolution: `OCCUPIED` already means "a vehicle is present and the connector isn't free for another session," which is precisely what all four collapsed states have in common. Expanding the Prisma enum would have been a CAP-002 schema change out of this work order's scope; inventing a second status vocabulary on the entities would have created exactly the kind of dual-vocabulary confusion this codebase's conventions avoid elsewhere.

**If finer-grained status ever becomes a real product requirement** (e.g., distinguishing "vehicle plugged in but not yet authorized" from "charging paused by the vehicle"), the fix is to widen `EvseStatus`/`ConnectorStatus` themselves (a real CAP-002-adjacent schema decision) — not to add a second, competing status field that duplicates what these enums are already supposed to mean.

## `OFFLINE` is connection-layer, not protocol-layer

No OCPP message reports `OFFLINE` — it's what the _absence_ of a connection implies. CAP-003's `StatusNotificationHandler` never sets `OFFLINE` directly; that mapping exists in the vocabulary for future use once a connection-loss-to-status-write path is designed (a Decision-5-adjacent question: should a dropped connection eventually flip a connector to `OFFLINE`, and after how long? — not resolved by this work order).

## Where this fires

`StatusNotificationHandler` (`src/ocpp/handlers/status-notification.handler.ts`) calls `mapToConnectorStatus()` and writes the result to `Connector.status` only — never `Evse.status`, since OCPP 1.6J's `StatusNotification` is connector-scoped, with no EVSE-level status concept distinct from it. See [OCPP 1.6J Adapter Guide](./OCPP_16J_ADAPTER_GUIDE.md).

## `connectorId` 0

OCPP 1.6J's `connectorId: 0` means "the Charge Point itself," not any specific connector. `ChargingStationStatus` (CAP-002) is administrative lifecycle only (`DRAFT`/`ACTIVE`/`INACTIVE`/`ARCHIVED`) — there is no operational field on `ChargingStation` for a whole-station device report to update. `StatusNotificationHandler` treats `connectorId: 0` as an accepted no-op: the message is valid OCPP and gets a `200`-equivalent `Accepted` response, but no domain write happens.
