# MOVOS Authorization Architecture v0.1

**Generated:** 2026-07-30 (WO-ARGOS-007)
**Companion documents:** [MOVOS Charging Ecosystem Architecture — §3 Authorization](../architecture/MOVOS_CHARGING_ECOSYSTEM_ARCHITECTURE_v0.1.md#3-authorization), [ChargingSession Architecture](./MOVOS_CHARGING_SESSION_ARCHITECTURE_v0.1.md), [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md) (capabilities #8–15)

This document designs the complete authorization model conceptually. **No Prisma model is created by this document.** RFID is designed in depth, as this work order requires; the other credential types are named and positioned but not designed to the same depth, since they are not needed for CAP-003's first vertical slice.

---

## Canonical concept: `AuthorizationCredential`

The single abstraction every authorization method is an instance of. A credential is _something that can authorize a session_ — a physical card, an app-issued token, a QR payload, an API key, a fleet account reference, or a Plug & Charge certificate.

```
AuthorizationCredential
├── id                  MOVOS-internal identifier (never the physical/external identifier)
├── type                RFID | QR | App | Remote | API | Fleet | PlugAndCharge | Guest | LocalList
├── externalIdentifier  the physical/protocol-facing identifier (e.g. an RFID UID) — distinct from id
├── status               ACTIVE | SUSPENDED | REVOKED | EXPIRED
├── validFrom / validUntil
├── ownerRef            who this credential belongs to (User, future Driver, future Fleet — polymorphic, unresolved)
└── metadata            type-specific data
```

`externalIdentifier` vs. `id` follows the exact discipline CAP-002 already established for `Evse.externalId`/`Connector.externalId`: the physical/protocol-facing value is never the primary key, is potentially mutable (a lost card gets replaced with a new physical identifier under the same logical credential, or a new credential entirely — see "Replacement" below), and is never trusted as globally unique across organizations without a scoped constraint.

## Conceptual relationships

```
AuthorizationCredential ──belongs to──> (User | Driver | Fleet)   [ownerRef — polymorphic, see note]
AuthorizationCredential ──attempted in──> AuthorizationAttempt ──resolves to──> AuthorizationDecision
AuthorizationDecision ──authorizes──> ChargingSession
ChargingSession ──occurs at──> Connector ──belongs to──> EVSE ──belongs to──> ChargingStation
external authorization provider ──may override──> AuthorizationDecision   [roaming/OCPI, out of scope]
```

- **`AuthorizationAttempt`**: a record of "this credential was presented at this station/connector at this time" — exists independent of whether it succeeded, since a rejected attempt is itself operationally meaningful (fraud detection, expired-card alerts, etc.).
- **`AuthorizationDecision`**: the outcome (`ACCEPTED` / `REJECTED` / `EXPIRED` / `BLOCKED` — reusing OCPP's own `idTagInfo.status` vocabulary where it maps cleanly) and the reasoning (which policy/list/provider made the call).
- **`ownerRef` is deliberately polymorphic and unresolved.** MOVOS has no `Driver` entity today (Architecture Backlog #47, confirmed absent). A credential's owner might eventually be a `User` (a MOVOS-registered account), a `Driver` (once that concept exists), or a `Fleet` (once that concept exists) — this document does not force a premature choice among them.
- **External authorization provider**: the roaming/OCPI hook (Architecture Backlog #28) — named for completeness, not designed.

---

## RFID — designed in depth

### Identifier normalization

RFID UIDs arrive from hardware in inconsistent formats (byte order, casing, separator characters vary by reader/vendor). MOVOS normalizes every UID to a canonical form (uppercase hex, no separators) at the point of ingestion — the same discipline as normalizing any external identifier before it becomes a lookup key, so `"04:A2:B3:C4"`, `"04a2b3c4"`, and `"04A2B3C4"` are recognized as the same physical card.

### Secure storage expectations

The raw UID is **not a secret** (it's readable by any compatible reader — this is not equivalent to a password), but it is still personally-identifiable-adjacent (traceable to a specific card, indirectly to a person) and should be stored with the same access-control discipline as any other credential data — not logged in plaintext in general application logs, exposed only through authenticated, role-gated endpoints, matching the existing `RolesGuard`/`OrgContextGuard` pattern.

### Status

`ACTIVE` (usable) / `SUSPENDED` (temporarily disabled, reversible) / `REVOKED` (permanently disabled) / `EXPIRED` (past `validUntil`, distinct from revocation — an administrative non-event, not a security event).

### Validity period

`validFrom`/`validUntil`, mirroring the `AuthorizationCredential` base shape. A card issued to a temporary/guest user would carry a short validity window; a permanent fleet card would have no `validUntil` (open-ended).

### Assignment

To a `User`, a future `Driver`, or a future `Fleet` — via the polymorphic `ownerRef` above. Reassignment (a card moving from one owner to another) is an explicit administrative action that should be audited (matching the existing `AuditService.record()` convention), not a silent update.

### Revocation

Sets `status = REVOKED`. Distinct from deletion — the credential record persists (for audit/history), but no future `AuthorizationAttempt` against it can resolve to `ACCEPTED`. Revocation should propagate to any Local Authorization List sync (below) so offline stations reject the card promptly, not just MOVOS's own live authorization path.

### Replacement

A lost/damaged card is handled as: revoke the old credential, issue a new `AuthorizationCredential` with a new `externalIdentifier`, both linked to the same `ownerRef`. The old credential's history is preserved, not deleted — consistent with this codebase's established "append resolution, don't silently rewrite" discipline for records with a history worth keeping.

### Local Authorization List synchronization

Charging stations can cache a list of known-good `idTag`/`idToken` values locally (OCPP `SendLocalList`/`GetLocalListVersion` in 1.6J; the equivalent local-list messages in 2.0.1) so they can authorize offline. MOVOS must treat this as a **push** concern: whenever a credential's status changes (new card activated, existing card revoked), affected stations' local lists need updating. The sync is versioned (OCPP's own list-version mechanism) so a station can detect it has a stale list and request a refresh.

### Offline authorization behavior

When a station cannot reach MOVOS (network outage), it falls back to its local list, if it has one and the presented card is on it. This means a **just-revoked** card could still authorize a session at a station that hasn't yet received the revocation push — an inherent, protocol-level limitation, not a MOVOS implementation gap. Sync latency should be minimized, and any session that starts under this condition should still be flagged for review (a policy question for a future capability, not designed here).

### Relationship to OCPP 1.6J `idTag`

`idTag` is a bare string (case-sensitive, up to 20 characters per the 1.6J spec). MOVOS's normalized `Authorization` event (see [OCPP Protocol Coexistence](./OCPP_PROTOCOL_COEXISTENCE_v0.1.md)) carries it as `idTag: string`; the normalization layer resolves it against `AuthorizationCredential.externalIdentifier` (after applying the same UID normalization described above) to find the credential, never treating the raw `idTag` value itself as a database key.

### Relationship to OCPP 2.0.1 `idToken` and token types

2.0.1 replaces the bare `idTag` string with a richer `IdTokenType` structure carrying both the value and a `type` enum (`ISO14443`, `ISO15693`, `Central`, `eMAID`, `KeyCode`, `Local`, `MacAddress`, `NoAuthorization`). MOVOS's `AuthorizationCredential.type` (`RFID`/`QR`/`App`/etc.) is a MOVOS-level classification, deliberately not a 1:1 mirror of 2.0.1's token-type enum — the mapping between the two happens in the OCPP 2.0.1 adapter (once built), not by importing 2.0.1's vocabulary into the domain (consistent with the [Protocol Coexistence](./OCPP_PROTOCOL_COEXISTENCE_v0.1.md) rule that the domain never depends on protocol-specific types).

### Distinction between the physical card identifier and the MOVOS credential ID

Already covered by the `externalIdentifier` vs. `id` split in the canonical concept above — restated here because the WO calls it out explicitly: **the physical card's UID is never the primary key of `AuthorizationCredential`, and the MOVOS credential ID is never printed on or transmitted by the physical card.**

---

## The other credential types (named, not designed)

| Type          | One-line positioning                                                                                                                                       | Architecture Backlog ID |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| QR            | App-less flow, typically resolves to a Remote Start with the scanned payload as the correlation key                                                        | #9                      |
| App           | Driver-initiated via a MOVOS/Kylum-branded mobile app, resolves to Remote Start/Stop                                                                       | #10                     |
| Remote        | The general mechanism underlying QR/App/API — MOVOS-initiated rather than device-initiated                                                                 | #11                     |
| API           | Third-party/fleet-management integration authorizing programmatically                                                                                      | #12                     |
| Fleet         | Authorization on behalf of a commercial fleet operator rather than an individual                                                                           | #13                     |
| PlugAndCharge | Automatic, certificate-based authorization on physical connection (ISO 15118)                                                                              | #14                     |
| Guest         | A short-validity, ownerless credential for one-off/visitor use — named here for completeness of the `AuthorizationCredential.type` enum; no further design | —                       |
| LocalList     | Not itself a credential type but the offline-distribution mechanism for RFID (and future types) — see "Local Authorization List synchronization" above     | #15                     |

None of these are implemented, or designed beyond this table, by this work order.

## Explicit non-goals for CAP-003

No `AuthorizationCredential` (or `AuthorizationAttempt`/`AuthorizationDecision`) Prisma model. No RFID CRUD API or UI. No `Authorize` OCPP message handling. This document is architecture only — required before RFID (or any authorization method) is implemented, not a substitute for that implementation.
