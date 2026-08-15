# Real Pilot Input Requirements

**Work order:** WO-ARGOS-042
**Status:** inventory/decision only — nothing below was created. Every value ARGOS must supply is listed; nothing is invented, guessed, or defaulted on their behalf.
**Baseline inspected:** production, live, immediately before any change — 1 `Organization` ("Kylum Energy"), 1 real `User` (`alipise@gmail.com`, `OWNER`), 6 `Site` rows, 0 `ChargingStation`/`Evse`/`Connector` rows.

## A. Site

Two options — ARGOS chooses, this document doesn't:

1. **Confirm `Centro Comercial Calima`** (`cmrq5sb71001xmo010tfp606p`) as the pilot site — the only one of the 6 with a real, `GOOGLE_PLACES`-confirmed address (`Cl. 70 #1-00, Calima, Cali, Valle del Cauca, Colombia`) and `ACTIVE` status. Real-looking data alone doesn't prove business intent — ARGOS's explicit confirmation is the actual requirement here, not the address quality.
2. **Or supply a new real site**: name, city, and address (the same three fields the real `/sites` "Nueva sede" form already asks for — nothing extra).

## B. Stations (2–3)

The pilot's actual workflow (`WorkOrder.stationId`) only ever needs a `ChargingStation` to exist — `Evse`/`Connector` rows are never read by the operational loop at all. For each of 2–3 stations, the **only field the schema requires** is:

- **`name`** — a real station name/label (e.g. what's physically posted on the unit, or how Kylum's own team refers to it). This is the one item that must come from Kylum — nothing here should be invented, including anything that looks like a serial number, model, or identifier.

Everything else on `ChargingStation` is optional and should be **omitted, not fabricated**, unless Kylum wants to supply it for a more complete record: `code`, `manufacturer`, `model`, `serialNumber`, `protocol`, `commissionedAt`. None of these are needed for the pilot's `WorkOrder` loop to work.

**EVSE/Connector are not required for this pilot at all.** They only become relevant if real (or simulated) OCPP connectivity is later added — out of this pilot's scope (`docs/pilot/OPERATIONAL_PILOT_V1.md`'s own scoping decision, still in force). If Kylum ever wants a station to carry a real connector record, the one genuinely required fact at that point is the connector's real physical `type` (`CCS2`/`TYPE2`/`CHADEMO`) — not invented here either.

## C. Operator

**Nothing outstanding.** The existing production `User` (`alipise@gmail.com`) has `OWNER` role, `ACTIVE` status — sufficient permissions for the complete operator pilot journey (assign, monitor, verify resolution). One cosmetic item, not a blocker: the record's `displayName` still reads "Administrador Kylum" rather than "Álvaro Pino" — ARGOS may want it updated for pilot clarity, but nothing technical depends on it.

## D. Technician

**Fully outstanding — the one genuinely missing real-world input this whole work order exists to name.** Required, from Kylum/ARGOS directly, nothing inferable:

- Javier Cabal Jr.'s real email address (this becomes his login)
- His real display name, exactly as he should see it referred to in MOVOS (a reasonable default would be "Javier Cabal Jr." itself, but this document doesn't assume even that without confirmation)
- A real, secure channel to deliver his credentials to (see E)

## E. Credential delivery

No email/invite system exists (unchanged since `docs/pilot/PILOT_ONBOARDING_REQUIREMENTS.md`) — a password is generated once, used to confirm login works, then handed to the real person through whatever channel Kylum/ARGOS already trusts for this kind of thing (a direct message, a call, an in-person handoff). This document does not choose that channel — it only requires that one, already trusted by the business, be named before provisioning proceeds.

## Provisioning preview (not executed — for reference once the inputs above are supplied)

```
Existing Kylum Organization (cmrmkq9ok0000rcnfa7q0loxd, ACTIVE)
        ↓
Confirmed Site — either "Centro Comercial Calima" (existing) or a new real Site
        ↓
2–3 real ChargingStations, each created via POST /sites/:siteId/charging-stations
  (name only — every other field omitted unless Kylum supplies it)
        ↓
Existing Álvaro Membership (already OWNER, ACTIVE — no change needed)
        ↓
New Javier User (email + displayName from section D, bcrypt-hashed password
  generated once, delivered via the confirmed channel from section E)
        ↓
New Javier Membership in Kylum Energy, role TECHNICIAN, status ACTIVE
        ↓
Authentication verification — Javier logs in for real, receives a real token
        ↓
Operator verification — Álvaro's /work-orders loads, sees the new stations
        ↓
Technician verification — Javier's /my-work loads (empty, correctly, until assigned)
        ↓
Pre-pilot smoke test — exactly WO-ARGOS-040's proven controlled-loop pattern,
  but with these real accounts, cleaned up the same way afterward if it's a
  dry run rather than the pilot's real WorkOrder #1
        ↓
READY FOR WORK ORDER #1
```

Every step in this chain reuses a mechanism already proven live in production (WO-ARGOS-040/041) — nothing new needs to be built to execute it.
