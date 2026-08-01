# DEC-017 — ChargingSession OFFLINE Transition Policy

**Generated:** 2026-08-01 (WO-ARGOS-009A)
**Status:** RECOMMENDATION — awaiting ARGOS decision. Not implemented by this work order (validation-only mandate).
**Scope:** the trigger condition and threshold for `ACTIVE → OFFLINE` (and, symmetrically, when to attempt `OFFLINE → ACTIVE` on recovery). Does not touch `ACTIVE → SUSPENDED` (device-reported charging suspension — a different trigger, already distinguished in [CAP-004 §8](./CAP-004_CHARGING_SESSIONS_FOUNDATION.md#8-session-lifecycle)).
**Related:** [Session Lifecycle Guide](../engineering/SESSION_LIFECYCLE_GUIDE.md), [CAP-003 Architecture Decisions — Decision 6](./CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-6--multi-instance-connection-routing)

## Current state (verified against the shipped code, not assumed)

- `ChargingSessionStatus.OFFLINE` exists; `ALLOWED_TRANSITIONS` permits `ACTIVE↔OFFLINE` and `OFFLINE→{FAILED,STOPPING,CANCELLED}` (`session-lifecycle.service.ts`).
- `SessionLifecycleService.suspendSession(id, 'OFFLINE')` is a real, callable method that performs the transition correctly.
- **No code path calls it automatically.** `ConnectionRegistryService` (CAP-003) and `SessionLifecycleService` (CAP-004) have zero wiring between them — confirmed by grep, no cross-references exist in either direction.
- A directly relevant existing mechanism already ships: `ConnectionRegistryService`'s stale-connection sweep (`connection-registry.service.ts`) runs every `SWEEP_INTERVAL_MS = 60_000`ms and force-closes a WebSocket idle for more than `STALE_THRESHOLD_MS = 300_000`ms (5 minutes) — but this is a **transport-layer** concept (a socket, not a session) and CAP-003 explicitly documents "connection presence is never equated with station availability."
- `BootNotification.conf` currently returns a **hardcoded, global** `interval: 300` (seconds) — this is the heartbeat cadence MOVOS itself instructs every device to use. It is not yet configurable per station or per vendor.

This last point matters directly: none of the three options below are being evaluated in a vacuum — a 300-second interval, and a 300-second transport-layer stale threshold, already exist in the shipped system.

## The options as posed

- **Option A** — fixed 60-second heartbeat timeout.
- **Option B** — heartbeat timeout = 3 × the configured heartbeat interval.
- **Option C** — manufacturer-profile-dependent timeout.

## Analysis

### Option A — fixed 60 seconds

**Incoherent with the system as it exists today, not just aggressive.** MOVOS currently tells every device to heartbeat every 300 seconds (`BootNotification.conf.interval`). A fixed 60-second OFFLINE timeout is _shorter than the interval MOVOS itself configured_ — a fully compliant, healthy device sending heartbeats exactly on schedule would still get marked `OFFLINE` between beats, every cycle, forever. Adopting Option A without first changing the interval is not a tradeoff, it's a bug. This is the single biggest strike against A: it does not just risk false positives under real-world jitter, it guarantees them against the system's own configured behavior.

**Interoperability:** a fixed threshold takes no account of connection quality — a station on a cellular uplink with real, non-pathological latency would be flagged exactly as readily as one on fiber.

**Scalability:** neutral — a per-session timer check is O(1) per session regardless of which option is chosen; A doesn't cost more or less than B to evaluate.

### Option B — 3 × configured heartbeat interval

At today's global interval (300s), this is 900 seconds (15 minutes). Two things to weigh:

**Operational consistency — the strongest argument for B.** It ties OFFLINE detection to a value MOVOS itself already dictates to the device (the `BootNotification.conf` interval), rather than an independent, unrelated magic number. If/when the interval becomes per-station configurable (a real, plausible future capability — device capability negotiation, Architecture Backlog #32–35), B scales with it automatically; A would need a manual, coordinated update every time.

**A real gap this recommendation must flag, not paper over.** 3× the _current_ 300s interval (900s) is **longer** than `ConnectionRegistryService`'s own 300s stale-sweep threshold. That means, as currently configured, the transport layer would force-close a dead connection at the 5-minute mark — 10 minutes before a standalone, interval-based OFFLINE check would ever fire. A session would sit `ACTIVE` for up to 10 minutes after its connection is verifiably gone. **This is not an argument against Option B's multiplier — it is an argument that Option B must not be built as a timer wholly independent of `ConnectionRegistryService`.** The correct trigger is the _first_ of: (1) `ConnectionRegistryService` reporting the connection for this station's `ocppIdentity` as closed/stale (already implemented, just not wired to sessions), or (2) no Heartbeat-carrying message received for 3× the configured interval, for the case where a device stops sending meaningful protocol traffic while some lower-level keepalive still holds the socket open. (2) is a real, distinct failure mode from (1) — a genuinely gone connection vs. a device that's stopped talking without formally disconnecting — and both need coverage, but (1) will almost always fire first given today's numbers, and that is a feature, not a redundancy to design away.

**False positives:** materially lower than A, and scoped to the actual signal (heartbeat cadence) rather than an arbitrary fixed clock.

**Scalability:** same O(1)-per-session cost as A; the multiplier is a stored/derived value per station, not a new per-check computation of consequence.

### Option C — manufacturer-profile-dependent

Requires a `CapabilityProfile`/vendor-catalog concept that does not exist — Architecture Backlog #32–35 are `ARCHITECTURE DRAFTED`/`UNDEFINED`, explicitly not implemented by CAP-003 or CAP-004, and every prior work order in this engagement has explicitly excluded a vendor catalog from scope ("Do not use manufacturer-specific conditional logic in the OCPP core" — CAP-003's own exclusion list, still in force). Adopting C now would mean building that catalog first — a materially larger scope than this decision, and a direct violation of the vendor-neutrality constraint this codebase enforces with an automated static-analysis test (`vendor-neutrality.spec.ts`). Not viable without a separate work order.

## Recommendation

**Option B**, with the explicit refinement above: OFFLINE detection is not a standalone timer — it is triggered by the first of (a) a `ConnectionRegistryService` connection-loss event for the station (wiring not yet built — see "Implementation note" below) or (b) heartbeat silence exceeding 3× the station's configured interval (currently a single global 300s value, not yet per-station).

This recommendation does not authorize implementation. It identifies precisely what "3× the configured heartbeat interval" must be coordinated with (the existing `ConnectionRegistryService` stale-sweep) so that whoever implements it does not build a second, disagreeing timeout mechanism next to the one CAP-003 already shipped.

## Implementation note (not authorized by this document)

Building this correctly requires, at minimum: (1) wiring `ConnectionRegistryService`'s disconnect/stale events to `SessionLifecycleService.suspendSession(id, 'OFFLINE')` for any session active on the affected station, and (2) a heartbeat-silence check as the secondary trigger. Both are genuinely new work, not covered by CAP-004, and not implemented by this validation gate.
