# MOVOS Device Capability Architecture v0.1

**Generated:** 2026-07-30 (WO-ARGOS-007)
**Companion documents:** [MOVOS Charging Ecosystem Architecture — §7 Device Lifecycle](../architecture/MOVOS_CHARGING_ECOSYSTEM_ARCHITECTURE_v0.1.md#7-device-lifecycle), [OCPP Protocol Coexistence](./OCPP_PROTOCOL_COEXISTENCE_v0.1.md), [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md) (#29, #32–35), [Kylum Hardware Information Request](../product/KYLUM_OCPP_HARDWARE_INFORMATION_REQUEST.md)

**No database model is created by this document, and no vendor catalog is populated.** This defines the future structure so that, once real hardware data exists (via the Kylum hardware information request), it has a place to go — and so that manufacturer-specific conditional logic never ends up hardcoded into the OCPP protocol core.

---

## The tree

```
Vendor
└── DeviceModel
    └── FirmwareVersion
        └── CapabilityProfile
```

- **`Vendor`** — a manufacturer (e.g. Kempower, ABB, Alpitronic — named as examples in the hardware information request, not confirmed Kylum suppliers).
- **`DeviceModel`** — a specific hardware model line from that vendor (e.g. "Satellite 400").
- **`FirmwareVersion`** — a specific firmware build for that model, since capability can differ by firmware even on identical hardware.
- **`CapabilityProfile`** — what a given (`Vendor`, `DeviceModel`, `FirmwareVersion`) combination actually supports, and how well-verified that claim is (see "Hardware validation levels" below).

This tree exists so that a capability question ("does this station support Remote Start?") is answered by looking up its profile, never by a conditional like `if (vendor === 'Kempower') { ... }` inside the OCPP engine — the exact anti-pattern this work order explicitly forbids in its Phase 8 instruction.

## `CapabilityProfile` — conceptual fields

- **OCPP versions supported** — which of 1.6J/2.0.1/future versions this firmware speaks.
- **Remote start / Remote stop / Reset / Unlock connector** — boolean-or-richer support flags per remote command (Architecture Backlog #36–39).
- **Reservation** — whether `ReserveNow`/`CancelReservation` (or 2.0.1 equivalent) is supported.
- **Smart Charging** — whether `SetChargingProfile`/`ClearChargingProfile` is supported, and if so which charging-rate-unit types.
- **Firmware update** — whether `UpdateFirmware` is supported, and any known constraints (e.g. requires a specific retrieval protocol).
- **Diagnostics** — whether `GetDiagnostics` is supported.
- **Local Authorization List** — whether `SendLocalList`/`GetLocalListVersion` is supported, and the list-size limit if known.
- **Certificate management** — whether the firmware supports certificate-based authentication (mutual TLS) and/or ISO 15118 certificate installation.
- **ISO 15118 / Plug & Charge** — whether the hardware has the physical/firmware capability for automatic vehicle authorization at all (a hardware, not just firmware, question in many cases).
- **Meter values / supported measurands** — which measurands (`Energy.Active.Import.Register`, `Power.Active.Import`, `Current.Import`, `Voltage`, `Temperature`, etc.) this firmware reports, and at what granularity.
- **Phase information** — single-phase vs. three-phase reporting/measurement capability.
- **Vendor extensions** — any known non-standard message types or behaviors this firmware exhibits (feeds the Vendor Extension Adapter — see [OCPP Protocol Coexistence](./OCPP_PROTOCOL_COEXISTENCE_v0.1.md)).
- **Known limitations** — free-text or structured notes on anything that deviates from spec-compliant behavior (e.g. "ignores `interval` field in `GetConfiguration` responses" — the kind of real-world finding integration testing surfaces).
- **Validation status** — see below; the honesty mechanism for this entire tree.

## Hardware validation levels

A strict, ordered vocabulary — **never skip a level, and never claim a level without the evidence that level requires:**

| Level                              | What it means                                                                                                                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UNASSESSED`                       | No information gathered at all.                                                                                                                                                                            |
| `DOCUMENTATION_REVIEWED`           | Vendor documentation/conformance statement has been read, but nothing has been tested against real or simulated hardware.                                                                                  |
| `SIMULATOR_VALIDATED`              | The described behavior has been exercised against MOVOS's own OCPP simulator (this work order builds one) — proves MOVOS's _engine_ handles the message correctly, proves nothing about the _real device_. |
| `REMOTE_HARDWARE_VALIDATED`        | Tested against real hardware, but remotely (e.g. a vendor-hosted test unit, not on-site) — stronger than simulator validation, still not a full field-conditions test.                                     |
| `PHYSICAL_HARDWARE_VALIDATED`      | Tested against a physical unit MOVOS controls directly, under realistic conditions.                                                                                                                        |
| `CERTIFICATION_EVIDENCE_AVAILABLE` | Formal OCPP certification evidence exists for this vendor/model/firmware combination (e.g. an Open Charge Alliance certification record).                                                                  |

**This work order's own implementation reaches `SIMULATOR_VALIDATED` and no higher** — see the CAP-003 implementation report for exactly which messages that applies to. No manufacturer, model, or firmware is claimed compatible at any level beyond what's actually been exercised. `CERTIFICATION_EVIDENCE_AVAILABLE` is not claimed for anything in this mission.

## Explicit non-goals for CAP-003

- No `Vendor`/`DeviceModel`/`FirmwareVersion`/`CapabilityProfile` Prisma model.
- No populated vendor catalog — not even for the manufacturers named as examples above; none are confirmed Kylum suppliers, and populating the catalog before the [Kylum Hardware Information Request](../product/KYLUM_OCPP_HARDWARE_INFORMATION_REQUEST.md) is answered would be inventing hardware facts.
- No manufacturer-specific conditional logic anywhere in `apps/movos-api/src/ocpp/` — verified by this work order's own code review discipline, not just stated as a goal.
