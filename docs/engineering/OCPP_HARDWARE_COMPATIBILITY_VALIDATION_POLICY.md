# OCPP Hardware Compatibility Validation Policy

**Generated:** 2026-07-30 (WO-ARGOS-007)
**Part of:** [Device Capability Architecture](../domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md), [OCPP Engine Guide](./OCPP_ENGINE_GUIDE.md)

## The policy

**No manufacturer, model, or firmware version may be described as compatible with MOVOS beyond the validation level actually earned**, using the six-level vocabulary defined in the [Device Capability Architecture](../domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md#hardware-validation-levels): `UNASSESSED` → `DOCUMENTATION_REVIEWED` → `SIMULATOR_VALIDATED` → `REMOTE_HARDWARE_VALIDATED` → `PHYSICAL_HARDWARE_VALIDATED` → `CERTIFICATION_EVIDENCE_AVAILABLE`.

This is not a formality — it exists because "we support OCPP" is a claim that's trivially easy to overstate and expensive to walk back once a pilot customer has heard it.

## Rules

1. **Never skip a level.** A vendor cannot be marked `PHYSICAL_HARDWARE_VALIDATED` on the strength of reading their documentation — that's `DOCUMENTATION_REVIEWED`, nothing more, until an actual test happens.
2. **`SIMULATOR_VALIDATED` proves the MOVOS engine, not the device.** Passing MOVOS's own OCPP simulator (`apps/movos-api/simulator/`) demonstrates that MOVOS correctly implements the protocol messages it claims to — it says nothing about whether any specific vendor's real firmware behaves identically. Do not present simulator success as hardware validation.
3. **`CERTIFICATION_EVIDENCE_AVAILABLE` requires actual evidence** — a real Open Charge Alliance (or equivalent) certification record for that specific vendor/model/firmware combination, not an assumption that "OCPP-certified hardware" in general will work.
4. **No level is claimed without a named evidence source.** Every compatibility statement should be traceable to what was actually done (which simulator run, which test unit, which certification document).

## What this work order's own implementation achieved

**`SIMULATOR_VALIDATED`, and no higher, for OCPP 1.6J `BootNotification`/`Heartbeat`/`StatusNotification` only.** This was verified via `apps/movos-api/simulator/ocpp-simulator.ts` exercising the booted application (see the CAP-003 implementation report for the exact boot-verification evidence). No physical charger has been tested. No manufacturer, model, or firmware is certified or claimed compatible by this work order.

## What this means for Kylum specifically

Nothing about Kylum's actual fleet is validated at any level yet, because no repository evidence exists about what hardware Kylum operates — see the [Kylum Hardware Information Request](../product/KYLUM_OCPP_HARDWARE_INFORMATION_REQUEST.md). Once that request is answered and a real unit is available (remotely or physically), the validation level for that specific vendor/model/firmware combination should be updated accordingly — starting from `DOCUMENTATION_REVIEWED` at best, until an actual connection is tested.

## Where this is tracked

Today: only in this document and the [Device Capability Architecture](../domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md)'s prose — no `CapabilityProfile` table exists yet to persist a validation level per device (Architecture Backlog #32–35). Populating that structure is future work, contingent on real vendor data.
