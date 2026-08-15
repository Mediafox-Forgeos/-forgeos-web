# Kylum Pilot Provisioning Record

**Work order:** WO-ARGOS-043
**Status:** production provisioning executed and verified. No secrets appear anywhere in this document.

## Confirmed configuration

| Object       | Value                                                               | ID                          |
| ------------ | ------------------------------------------------------------------- | --------------------------- |
| Organization | Kylum Energy                                                        | `cmrmkq9ok0000rcnfa7q0loxd` |
| Site         | Centro Comercial Calima                                             | `cmrq5sb71001xmo010tfp606p` |
| Station 1    | Calima - Estación 01                                                | `cmsty5fpl001bo0019u7qh7r5` |
| Station 2    | Calima - Estación 02                                                | `cmsty5fvh001fo001iymlfpb1` |
| Station 3    | Calima - Estación 03                                                | `cmsty5g0v001jo001iivi8qmd` |
| Operator     | Álvaro Pino (`alipise@gmail.com`), `OWNER`/`ACTIVE`                 | `cmrmkqapu0001rcnfly4x7qkz` |
| Technician   | Javier Cabal Jr. (`javier.cabalf@gmail.com`), `TECHNICIAN`/`ACTIVE` | `cmsty8vgh0000rc29zrzfyhy9` |

All three stations carry only `name` + `siteId` — no manufacturer, model, serial number, protocol, or OCPP identifier was invented; every optional field is honestly `null`. Station `status` is `DRAFT`, the schema's own default — no status was invented either; ARGOS may choose to move them to `ACTIVE` later, that's a business decision this record doesn't make for them.

## What changed and how

- **Stations**: created via the real `POST /sites/:siteId/charging-stations` API, authenticated as the real operator — same mechanism proven in every prior pilot work order.
- **Álvaro**: `displayName` updated from "Administrador Kylum" to "Álvaro Pino" via a single, precisely-scoped database update. Verified before and after: email, password hash, user id, status, `OWNER` role, and `ACTIVE` membership all unchanged. Verified live: login still succeeds and returns the new display name.
- **Javier**: no existing user with `javier.cabalf@gmail.com` was found (verified first). A new `User` + Kylum `Membership` (`TECHNICIAN`, `ACTIVE`) were created, following the exact pattern already proven in WO-ARGOS-037/040/041.

## Credential delivery

`CREDENTIAL_DELIVERY_REQUIRED` — Javier's temporary password was generated and bcrypt-hashed for storage (12 rounds, matching every other account in this system); the plaintext was written once to a private local file (never committed, never printed in any terminal output, PR, or report) for ARGOS to retrieve and deliver through the approved channels:

- **Primary:** email
- **Secondary confirmation/support:** WhatsApp

Javier should be asked to change his password after first login once a self-service mechanism exists — none does today (unchanged finding from `docs/pilot/PILOT_ONBOARDING_REQUIREMENTS.md`).

## Verification performed (all live, all real)

- Operator (Álvaro): login succeeds, `/auth/me` resolves, sees the pilot site, sees all 3 pilot stations, `/work-orders` reachable, `/work-orders/assignable-technicians` correctly lists Javier.
- Technician (Javier): login succeeds, organization resolves to Kylum Energy, role is `TECHNICIAN`, `/my-work` reachable (empty, correctly, before any assignment), correctly forbidden (`403`) from both `/work-orders` and `/work-orders/assignable-technicians`.
- **Controlled pre-pilot smoke test** (`[WO-ARGOS-043 PRE-PILOT TEST]`, one of the three pilot stations): full loop with the real Álvaro and Javier accounts — create → assign → technician self-scoped `/my-work` → start → all 4 checklist stages → resolve → operator's canonical 8-event timeline. Passed in full. **The test `WorkOrder` and its 8 events were then deleted** — verified afterward: 0 `WorkOrder`s in production, all other pilot configuration (org, site, stations, both memberships) fully intact.

## Final production inventory (verified after cleanup)

1 `Organization`, 2 `User`s (the pre-existing operator + the new technician), 6 `Site`s (unchanged — 5 pre-existing QA sites, untouched, not deleted, per instruction), 3 pilot `ChargingStation`s, 0 `WorkOrder`s, 0 remaining `WO-ARGOS-043` markers.

## Remaining risk

None identified at the BLOCKER/HIGH level. The only open item is the credential handoff itself — a human action (ARGOS delivering Javier's password via email/WhatsApp), not a technical one.
