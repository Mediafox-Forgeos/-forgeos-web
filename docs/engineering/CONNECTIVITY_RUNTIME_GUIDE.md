# Connectivity Runtime Guide

**Generated:** 2026-08-02 (WO-ARGOS-010)
**Code:** `apps/movos-api/src/ocpp/connectivity/connectivity-coordinator.service.ts`, `apps/movos-api/src/ocpp/connection-registry/connection-registry.service.ts`
**Architecture:** [CAP-005 Connectivity Engine](../domain/CAP-005_CONNECTIVITY_ENGINE.md), [DEC-017](../domain/DEC-017_OFFLINE_POLICY.md)

## Source of truth

`ConnectionRegistryService`'s in-memory `Map<ocppIdentity, ConnectionRecord>` is the **only** live-connectivity source of truth at any instant — it is always correct about "is a socket open right now," and always empty at process boot. `ChargingStation.connectivityStatus` and its sibling fields are a **persisted record of last-known evidence**, not a live source — they can lag the registry by up to one sweep interval (60s) and are explicitly reconciled to `UNKNOWN` on every restart (§ below), never trusted as "live" across a process boundary.

## Constants (both hardcoded, not yet per-station)

| Constant                                                | Value              | Meaning                                                                      |
| ------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------- |
| `STALE_THRESHOLD_MS` (`connection-registry.service.ts`) | 300,000ms (5 min)  | A connection idle longer than this is force-closed by the sweep              |
| `SWEEP_INTERVAL_MS` (`connection-registry.service.ts`)  | 60,000ms (1 min)   | How often the sweep runs                                                     |
| `ConnectivityCoordinator.RECOVERY_WINDOW_MS`            | 900,000ms (15 min) | How long after going `OFFLINE` a session may still be recovered on reconnect |

Because the sweep only runs every 60s, real-world staleness detection lands somewhere between 300s and 360s after the last inbound message — not exactly at 300s.

## Restart behavior — the exact rule

`ConnectivityCoordinator.onModuleInit()` runs once per process start, before any connection can register:

```sql
UPDATE "ChargingStation" SET "connectivityStatus" = 'UNKNOWN' WHERE "connectivityStatus" = 'ONLINE';
```

- A station persisted `ONLINE` is reset to `UNKNOWN` — that belief predates this process and cannot be live fact (the registry it depended on no longer exists).
- A station persisted `OFFLINE` is left `OFFLINE` — a verified loss of connection doesn't become less true because the process restarted.
- Nothing is ever guessed to `OFFLINE` on restart — only `ONLINE → UNKNOWN` is forced.

## Known limitations

- **Single global heartbeat interval.** `BootNotification.conf.interval` is a hardcoded `300` for every station — `RECOVERY_WINDOW_MS` is derived from this same constant, not a real per-station negotiated value. See DEC-017.
- **Clean disconnect never moves a session OFFLINE.** Only a stale-sweep eviction does. See [CAP-005 §4](../domain/CAP-005_CONNECTIVITY_ENGINE.md#4-known-deliberate-asymmetry-clean-disconnect-vs-stale) for the full explanation and the resulting stuck-`ACTIVE` edge case.
- **`lastSeenAt` only updates at connect/reconnect**, not per inbound message — see [CAP-005 §5](../domain/CAP-005_CONNECTIVITY_ENGINE.md#5-persisted-state-and-startup-reconciliation).
- **Single-instance only.** Like `ConnectionRegistryService` itself, none of this is Redis-backed or safe across multiple `movos-api` instances — a second instance has its own independent, empty registry.

## Real-boot validation record (WO-ARGOS-010)

Performed against a compiled `apps/movos-api` instance (`node dist/main.js`), real local PostgreSQL (`movos_dev`), and the repository's real `OcppSimulator` class (never mocked) — no code path under test was stubbed.

1. **Connect.** Simulator connected as `movos-9b8e94e6`, sent BootNotification/Heartbeat/StatusNotification/Authorize/StartTransaction. Verified via `psql`: `ChargingStation.connectivityStatus = 'ONLINE'`, `lastConnectedAt`/`lastSeenAt` set, `lastProtocolVersion = 'OCPP1_6J'`; a new `ChargingSession` row created with `status = 'ACTIVE'`.
2. **Idle past the real stale threshold.** The simulator sent no further messages and stayed connected (no client-initiated close) for 6 real minutes — past the 300s threshold and the following 60s sweep tick. Verified via `psql`: the server's own stale sweep force-closed the socket server-side (`code 1001`), `ChargingStation.connectivityStatus = 'OFFLINE'`, `lastDisconnectedAt` set, and the `ChargingSession` moved to `status = 'OFFLINE'` — not completed, not failed.
3. **Reconnect with the same protocol transaction.** A second `OcppSimulator` instance connected with the same `ocppIdentity`/secret (a real device reconnect, not a resumed socket). Verified via `psql`: `ChargingStation.connectivityStatus` returned to `ONLINE`; the `OFFLINE` `ChargingSession` was recovered to `status = 'ACTIVE'` via `SessionLifecycleService.resumeSession` (within the 15-minute recovery window); exactly **one** `ChargingSession` row existed for the station throughout — no duplicate was created by the reconnect.
4. **Cleanup.** The recovered session was closed with a real StopTransaction; the simulator disconnected cleanly; the temporary validation scripts, the rotated OCPP secret, and the login tokens used for this run were deleted after the run completed.

Exact timestamps and row IDs for this run are recorded in the WO-ARGOS-010 final report, not duplicated here.

## Related guides

[Session Reconnect Recovery Guide](./SESSION_RECONNECT_RECOVERY_GUIDE.md) · [OCPP Engine Guide](./OCPP_ENGINE_GUIDE.md) · [Session Lifecycle Guide](./SESSION_LIFECYCLE_GUIDE.md)
