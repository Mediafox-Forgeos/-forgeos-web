# Vertical Boundaries

**Work order:** WO-ARGOS-028 (ForgeOS Core Extraction)
**Status:** ARCHITECTURE DISCOVERY. No code, API, migration, or `schema.prisma` change.
**Mission:** where mobility ends and ForgeOS begins — grounded in the real `schema.prisma` on `main`, not a hypothetical one.

## The boundary test

An entity or field is **mobility-specific** if substituting its nouns for another industry's breaks its meaning — `meterStart`/`meterStop` in `energyWh` means nothing to a coworking-space booking. It's **universal** if the same description still reads correctly after the substitution — "a status-transition-enforced case with an assignee and a resolution note" describes a support ticket exactly as well as it describes an `Action`.

## What is mobility-specific

| Entity                                | Why it fails the test                                                                                                                                                                                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChargingStation`                     | `ocppIdentity`, `ocppSecretHash`, `protocol` ("OCPP 1.6J") are charging-hardware-provisioning concepts with no analog outside metered power delivery.                                                                                                           |
| `Evse`                                | "Electric Vehicle Supply Equipment" is the name of the concept — it cannot be renamed into a different industry without becoming a different entity.                                                                                                            |
| `Connector`                           | `ConnectorType` (`CCS2`/`TYPE2`/`CHADEMO`) is a closed, physical-standard enum specific to EV charging hardware.                                                                                                                                                |
| `MeterValue`                          | `powerW`/`voltage`/`current`/`frequency` are electrical telemetry fields — meaningful for charging, meaningless for a parking session or a desk booking.                                                                                                        |
| `ChargingSession`                     | `meterStart`/`meterStop`/`energyWh`/`protocolTransactionId`/`protocolVersion` are OCPP/charging vocabulary throughout, even though the entity's _shape_ (credential-gated, lifecycle-managed, terminates with a reason) is universal — see the Gray Zone below. |
| `AuthorizationCredential.type` values | `RFID`, `PLUG_AND_CHARGE` are charging-specific credential media, even though "a typed, revocable, expirable credential" as a concept is not.                                                                                                                   |
| `TariffSnapshot`'s price fields       | `energyPricePerKwh`, `pricePerMinute` are charging-specific price components, even though "price frozen as an immutable snapshot at the moment it applied" is not.                                                                                              |
| `OcppProtocolEvent`                   | The entire model is a protocol-adapter concern — `OcppMessageType`, `protocolMessageId` only mean something to an OCPP-speaking device.                                                                                                                         |
| `StationHealthService`'s topology     | The `station → evses → connectors` shape it walks is this schema's real hierarchy, hardcoded — a different vertical's asset tree would have different depth and different node types.                                                                           |

## What is universal

| Concept                   | Where it already lives (unnamed)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Why it passes the test                                                                                                                                                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Recommendation**        | `RecommendationService`'s contract (stateless, explained, evidenced, non-persistent) — see [UNIVERSAL_PRIMITIVES.md](./UNIVERSAL_PRIMITIVES.md)                                                                                                                                                                                                                                                                                                                                                            | "A computed, evidenced suggestion that disappears once its trigger clears" needs nothing charging-specific to be true.                                                                                                                                                                          |
| **Action**                | The `Action` entity, almost unmodified                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | As found in [CAPABILITY_INVENTORY.md](./CAPABILITY_INVENTORY.md): only `chargingStationId`/`recommendationType` are vertical-bound; the state machine, snapshot, assignee, and cooldown are not.                                                                                                |
| **Timeline**              | **Not implemented anywhere** — this is the name for the gap [LEARNING_SIGNALS.md](../product/LEARNING_SIGNALS.md) signal 5 already found: `Action` overwrites `status`/`assignedToUserId`/`snoozedUntil` in place, with no ordered history of how a subject got from one state to another. A Timeline primitive (an ordered, append-only sequence of Events/Observations/transitions for one subject) is the general shape that gap is asking for — and would fix it for every subject, not just `Action`. |
| **State transition**      | Solved **twice, independently, with no shared code** — `ChargingSessionStatus`'s ten-state lifecycle engine (CAP-004) and `ActionStatus`'s five-state `VALID_TRANSITIONS` map (WO-ARGOS-026) both hand-roll "reject a transition the current state doesn't allow, server-side, never trusting the caller." Neither references the other. This is the clearest sign a generic finite-state-machine primitive belongs in Core: it has already been needed twice, and built twice.                            |
| **Organizational memory** | Not implemented — [ORGANIZATIONAL_MEMORY.md](../product/ORGANIZATIONAL_MEMORY.md) design only                                                                                                                                                                                                                                                                                                                                                                                                              | Every one of its five target questions (chronic subject, best handler, common pattern, seasonal curve, response-time trend) is phrased generically enough today that it required no charging vocabulary to state — see [UNIVERSAL_PRIMITIVES.md](./UNIVERSAL_PRIMITIVES.md)'s Memory primitive. |

## The clearest boundary case not asked for, but worth naming

`User`, `Organization`, `Membership`, `RefreshSession`, and `AuditEvent` have **zero mobility-specific fields today**. Multi-tenancy, role-based membership (`OWNER`/`ADMIN`/`OPERATOR`/`SUPPORT`/`ANALYST`/`VIEWER`), authentication, and human-attributable audit logging were built generically from the start, without a single charging-vocabulary field anywhere in them. This is the boundary already drawn correctly, three CAP-numbers ago, without anyone calling it "ForgeOS Core" at the time — the strongest existing evidence that the rest of this document's proposed extractions are the same kind of move, not a new kind of risk.

## The gray zone: `ChargingSession` itself

`ChargingSession` is the hardest case because it fails the substitution test on its _fields_ while passing it on its _shape_. Stripped of `meterStart`/`meterStop`/`energyWh`/`protocolTransactionId`/`protocolVersion`, what remains — an authorization-credential reference, a billing-account reference, a status enum, a termination reason, an immutable `startedAt`, a nullable `endedAt` that can only be set once — describes a parking session, an equipment rental, or a coworking booking without alteration. The honest boundary is not "`ChargingSession` is Core" or "`ChargingSession` is MOVOS" — it's that `ChargingSession` is a mobility-specific **implementation** of a universal **`Session`/`Transaction` shape**, the same relationship `Action` already has to `RecommendationType`, just with more fields on the specific side of the line. [CAPABILITY_INVENTORY.md](./CAPABILITY_INVENTORY.md) classified Sessions Hybrid for exactly this reason.

## Reading the boundary as a diagram

```
Mobility-specific (MOVOS)          Universal (ForgeOS Core, candidate)
──────────────────────────         ──────────────────────────────────
ChargingStation                    Device / Asset (topology + liveness)
Evse, Connector                    (children in an Asset hierarchy)
MeterValue                         Event (append-only telemetry/fact)
ChargingSession fields             Session/Transaction shape
  (meterStart, protocolVersion)      (credential-gated, lifecycle-managed)
TariffSnapshot price fields         Snapshot-pricing discipline
AuthorizationCredential.type         Credential (typed, revocable, expirable)
RecommendationType (the 5)         Recommendation (the contract)
                                    Action (already ~Core, see inventory)
                                    Timeline (not yet built — a real gap)
                                    State transition / FSM (built twice already)
                                    Organizational memory (design only)
User / Organization / Membership   — already fully Core, no line to draw
```

[FORGEOS_STACK.md](./FORGEOS_STACK.md) takes the right-hand column and arranges it into layers; [FORGEOS_POSITIONING.md](./FORGEOS_POSITIONING.md) answers what kind of thing the resulting whole actually is.
