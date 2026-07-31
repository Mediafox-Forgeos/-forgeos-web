# OCPP Simulator Guide

**Generated:** 2026-07-30 (WO-ARGOS-007)
**Code:** `apps/movos-api/simulator/ocpp-simulator.ts`
**Part of:** [OCPP Engine Guide](./OCPP_ENGINE_GUIDE.md)

## What this is, and is not

The simulator is a development/test tool that behaves like a physical charge point's WebSocket client — it connects with Basic Auth and a declared OCPP subprotocol, sends `BootNotification`/`Heartbeat`/`StatusNotification`, and can deliberately misbehave (malformed frames, invalid credentials, unsupported actions) to exercise the engine's defensive paths.

**It does not simulate real charger firmware.** It proves the MOVOS OCPP engine behaves correctly against a well-formed and deliberately-adversarial protocol stream — it does not prove any specific vendor's hardware will behave identically. See the [Hardware Compatibility Validation Policy](./OCPP_HARDWARE_COMPATIBILITY_VALIDATION_POLICY.md): passing against this simulator earns `SIMULATOR_VALIDATED`, nothing more.

## Why it lives outside `src/`

`apps/movos-api/tsconfig.build.json` only includes `src/**/*` — the simulator lives at `apps/movos-api/simulator/`, structurally guaranteeing it is never compiled into `dist/` or shipped in the production build. It **is** included in the dev-time `tsconfig.json` (so `pnpm typecheck` and `pnpm lint` still cover it) — see the `simulator/**/*` entry there.

## Local usage

Requires a running `apps/movos-api` instance with a real Postgres database (the simulator authenticates against a real `ChargingStation.ocppSecretHash`, which requires a provisioned station to exist).

```bash
# 1. Provision a station via the real API first (OWNER/ADMIN token required):
#    POST /api/v1/charging-stations/:id/ocpp-provisioning
#    → note the returned { ocppIdentity, plaintextSecret }

# 2. Run the simulator's built-in CLI flow (Boot -> Heartbeat -> Status -> disconnect):
cd apps/movos-api
npx ts-node simulator/ocpp-simulator.ts \
  --identity=<ocppIdentity> \
  --secret=<plaintextSecret> \
  --host=localhost \
  --port=4000 \
  --protocol=OCPP1_6J
```

## Programmatic usage (for tests or scripted scenarios)

```ts
import { OcppSimulator } from '../simulator/ocpp-simulator';

const sim = new OcppSimulator({
  host: 'localhost',
  port: 4000,
  ocppIdentity: 'movos-abc123',
  secret: 'the-plaintext-secret',
  protocolVersion: 'OCPP1_6J',
});

await sim.connect();
await sim.sendBootNotification('Acme Corp', 'Model X');
await sim.sendHeartbeat();
await sim.sendStatusNotification(1, 'Charging');
sim.disconnect();
```

## Scenario methods

| Method                                                      | Exercises                                                                                                              |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `connect()`                                                 | Full handshake: Basic Auth + subprotocol negotiation                                                                   |
| `sendBootNotification(vendor, model, firmwareVersion?)`     | The Boot vertical                                                                                                      |
| `sendHeartbeat()`                                           | The Heartbeat vertical                                                                                                 |
| `sendStatusNotification(connectorId, status, errorCode?)`   | The Status vertical, including connector mapping                                                                       |
| `sendUnsupportedAction()`                                   | Sends `Authorize` — proves unsupported-action handling returns a `CALLERROR`, never a crash or silent drop             |
| `sendMalformedFrame()`                                      | Sends raw non-JSON bytes — proves the transport survives garbage input                                                 |
| `sendMalformedBootNotification()`                           | Sends valid JSON with a missing required field — proves payload-level validation                                       |
| `disconnect()` / reconnecting via a second `connect()` call | Proves the connection registry's deterministic-reconnection behavior (see [OCPP Engine Guide](./OCPP_ENGINE_GUIDE.md)) |

To exercise **duplicate connections**, create two `OcppSimulator` instances with the same `ocppIdentity` and connect both — the second connection should succeed and the first should observe a `close` event (code `1000`, reason `replaced-by-new-connection`).

To exercise **invalid credentials**, construct a simulator with a wrong `secret` and call `connect()` — it should reject with an `unexpected-response` error (HTTP 401 at the upgrade handshake).

To exercise **OCPP 2.0.1 detection**, set `protocolVersion: 'OCPP2_0_1'` — the connection succeeds (if credentials are valid) but every subsequent `send*` call resolves to a `CALLERROR` response, never a normal `CALLRESULT` (see [OCPP 2.0.1 Architecture Guide](./OCPP_201_ARCHITECTURE_GUIDE.md)).

## Not run by CI

The simulator requires a live database and a running server — CI has no live database service (see [Testing Strategy](./TESTING_STRATEGY.md)). Automated coverage of the engine's behavior lives in the unit test suites under `src/ocpp/**/*.spec.ts` (mocked dependencies); the simulator is for manual/local verification and future integration-testing infrastructure once a live DB is available in CI.

## Manual validation record (WO-ARGOS-008, 2026-07-31)

The simulator was run exactly as described above against a real, booted `apps/movos-api` instance backed by a real local PostgreSQL database, exercising all 12 scenarios this guide's methods support (valid connection, Boot/Heartbeat/Status, connector 0, invalid credentials, unknown identity, duplicate connection, disconnect/reconnect, malformed frame, unsupported action, OCPP 2.0.1 detection). Full evidence — exact environment, exact results, database assertions, log-safety findings — is recorded in [CAP-003 Architecture Decisions — WO-ARGOS-008 Runtime Validation Record](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#wo-argos-008-runtime-validation-record-2026-07-31). This was a one-time manual run, not a new CI capability — the "Not run by CI" limitation above still applies going forward.
