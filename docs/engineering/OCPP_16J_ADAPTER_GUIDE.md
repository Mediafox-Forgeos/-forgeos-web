# OCPP 1.6J Adapter Guide

**Generated:** 2026-07-30 (WO-ARGOS-007)
**Code:** `apps/movos-api/src/ocpp/protocol/ocpp16/ocpp16-adapter.ts`
**Part of:** [OCPP Engine Guide](./OCPP_ENGINE_GUIDE.md)

## What's implemented

| Action               | Direction | Status                                                                                                               |
| -------------------- | --------- | -------------------------------------------------------------------------------------------------------------------- |
| `BootNotification`   | Inbound   | Implemented — requires `chargePointVendor` and `chargePointModel`; `firmwareVersion` optional                        |
| `Heartbeat`          | Inbound   | Implemented — no payload requirements                                                                                |
| `StatusNotification` | Inbound   | Implemented — requires `status`; `connectorId`, `errorCode`, `timestamp` optional/defaulted                          |
| Everything else      | Inbound   | `UnsupportedMessage` (reason `not_implemented`) → `CALLERROR`                                                        |
| Everything           | Outbound  | Not implemented — `capabilities.supportedOutbound` is empty; `formatOutbound()` throws `CapabilityNotSupportedError` |

## BootNotification

- Required: `chargePointVendor`, `chargePointModel` (both strings) — missing either is a `MalformedFrame`, not silently accepted with defaults.
- `vendor`/`model` are carried through as **opaque strings** — the adapter never branches on their value (see `vendor-neutrality.spec.ts`, a repo-wide static guard against exactly that).
- The response is `{ status: 'Accepted', currentTime, interval: 300 }` — `interval` is the heartbeat interval MOVOS asks the device to use, hardcoded to 300 seconds. There is no per-station configuration for this yet.
- **Does not write to `ChargingStation.manufacturer`/`model`/`protocol`** — see [OCPP Engine Guide](./OCPP_ENGINE_GUIDE.md) and [CAP-003 Architecture Decisions — Decision 5](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-5--live-state-write-path) for why: whether BootNotification should eventually confirm/overwrite the administratively-set `protocol` field is an explicitly open question, not resolved by this adapter.

## Heartbeat

- No payload validation needed (OCPP 1.6J's Heartbeat has no request fields).
- Response is `{ currentTime }`.
- Does not write any business record — see [OCPP Engine Guide](./OCPP_ENGINE_GUIDE.md)'s "what does not ship" and the `HeartbeatHandler`'s own doc comment.

## StatusNotification

- Required: `status`, and it must be one of the nine OCPP 1.6J `ChargePointStatus` values the adapter recognizes (`Available`, `Preparing`, `Charging`, `SuspendedEVSE`, `SuspendedEV`, `Finishing`, `Reserved`, `Unavailable`, `Faulted`). Anything else is a `MalformedFrame`.
- `connectorId` is a plain integer per the OCPP 1.6J spec; `0` means the Charge Point itself, not a specific connector — see [OCPP/Domain Status Mapping](./OCPP_DOMAIN_STATUS_MAPPING.md) for how the handler treats that case.
- Status mapping onto the normalized vocabulary happens in the adapter (`mapOcpp16Status`); mapping onto the Prisma `EvseStatus`/`ConnectorStatus` enums happens one layer further out, in `normalization/status-mapping.ts` — see the status-mapping guide.

## What's deliberately not implemented in this vertical

`Authorize`, `StartTransaction`, `StopTransaction`, `MeterValues`, `DataTransfer`, all remote-command CALLs (`RemoteStartTransaction`, `RemoteStopTransaction`, `Reset`, `UnlockConnector`, `ChangeAvailability`, `ChangeConfiguration`, `GetConfiguration`, `ClearCache`, `SendLocalList`, `GetLocalListVersion`, `ReserveNow`, `CancelReservation`, `SetChargingProfile`, `ClearChargingProfile`, `GetCompositeSchedule`, `TriggerMessage`, `UpdateFirmware`, `GetDiagnostics`, `FirmwareStatusNotification`, `DiagnosticsStatusNotification`). Every one of these resolves to `UnsupportedMessage` today. See the [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md) for where each is tracked.

## Testing

`src/ocpp/protocol/ocpp16/ocpp16-adapter.spec.ts` — unit tests for parsing, formatting, malformed-payload rejection, and unsupported-action handling. No live device or simulator run is exercised by CI; see [Simulator Guide](./OCPP_SIMULATOR_GUIDE.md) for manual verification.
