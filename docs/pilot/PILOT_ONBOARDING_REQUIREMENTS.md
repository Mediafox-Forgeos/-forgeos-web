# Pilot Onboarding Requirements

**Work order:** WO-ARGOS-039
**Method:** every claim below is traced to a real file, endpoint, or its absence — verified by reading the actual controllers and searching the actual frontend for the calls in question, not assumed from a prior audit. No onboarding UI was built to produce this document; it documents the truth as it stands.

## How is an Organization created?

**Only via `apps/movos-api/prisma/seed.ts`, a TypeScript script run with `ts-node` (`pnpm seed`).** There is no `POST /organizations` endpoint — `organizations.controller.ts` has exactly one route, `GET /organizations` (list the orgs the current user already belongs to). The seed script itself `upsert`s a single organization by slug (`kylum-energy`, hardcoded) — running it a second time is safe, but pointed at a **different** organization requires editing the script or writing a new one-off script by hand.

## How are Users created?

**Only via `prisma/seed.ts` or direct database access.** `AuthController` has `login`, `refresh`, `logout`, `me`, `select-organization` — no `register`/`signup` endpoint exists anywhere in the codebase (confirmed by searching every controller for anything resembling one). A new user's `passwordHash` must be produced with `bcrypt` at the same cost factor the app uses (12 rounds, matching `seed.ts`'s own convention) — the seed script already does this correctly and is the safest template to copy rather than reimplement.

## How are Memberships created, and how are roles assigned?

**Only via `prisma/seed.ts` or direct database access.** No `POST`/`PATCH` membership endpoint exists. `seed.ts` already contains a real, working example of creating a `TECHNICIAN` membership (added in WO-ARGOS-037, for `tecnico@kylum.co`) — the pattern to copy for a real pilot technician is exactly that block, with `email`, `displayName`, and the password changed.

## How are sites/stations/connectors provisioned?

- **Sites: through the real UI.** `/sites`' "Nueva sede" modal calls the real `POST /sites` (`OWNER`/`ADMIN`), including the Google Places-backed location picker. This is the one genuinely complete, self-service provisioning path in the entire product.
- **Stations: API-only, no UI.** `POST /sites/:siteId/charging-stations` is real, tested, and used throughout this engagement's own e2e suites — but no page in `movos-web` calls it (verified: zero matches searching the whole frontend for a `charging-stations` `POST`). A pilot station must be created with a direct API call (`curl`, Postman, or a small script) by someone holding an `OWNER`/`ADMIN` access token.
- **Evses/Connectors: API-only, same situation**, and **not required for this pilot** — the `WorkOrder` loop only ever references `ChargingStation` directly (`WorkOrder.stationId`), never `Evse`/`Connector`.

## How are credentials handled?

- **User login credentials:** bcrypt-hashed passwords, real JWT access tokens (15 min) + httpOnly refresh cookies (7 days), rate-limited login (5/min/IP, `@Throttle`). This is mature, tested infrastructure — nothing pilot-specific needed here beyond picking real passwords for the two pilot accounts.
- **OCPP device credentials** (only relevant if a real or simulated charger will actually connect): `POST /charging-stations/:id/ocpp-provisioning` (`OWNER`/`ADMIN`) generates a station identity and a 256-bit secret, returned in plaintext **exactly once**, in that response body — never logged, never persisted in plaintext, never retrievable again (`docs/engineering/OCPP_DEVICE_PROVISIONING_GUIDE.md`). Whoever calls this must manually relay the identity+secret to whoever configures the physical (or simulated) charger's OCPP client. There is no UI for this either.

## How does charger/connectivity data enter MOVOS?

Exactly one way: a real WebSocket connection to `wss://<host>/ocpp/{ocppIdentity}`, authenticated with the credential above, handled by `ConnectionRegistryService`/`ConnectivityCoordinator`. This is the **only** writer of `ChargingStation.connectivityStatus`/`lastConnectedAt`/`lastDisconnectedAt` anywhere in the codebase — there is no manual "mark this station offline" control anywhere, by design (the field means "real evidence from a real connection," and inventing a manual override would compromise that meaning). Practical consequence: if the pilot wants to exercise Rule 1 (automatic connectivity-loss `WorkOrder` creation) without real hardware, the only honest way is MOVOS's own OCPP simulator (`apps/movos-api/simulator/`), which speaks real OCPP over a real WebSocket connection — not a database shortcut.

## What configuration currently requires database/admin/developer intervention?

Everything in this list, confirmed above, with no UI or self-service API path today:

1. Organization creation
2. User creation
3. Membership creation and role assignment
4. Station creation
5. Team roster visibility (no `GET /users`/members endpoint exists — not even read-only)

## What can already be done through the UI?

1. Login/logout/session management (full)
2. Site creation, viewing, updating, archiving
3. `WorkOrder` creation (manual, or from a `HIGH` recommendation), assignment (as of WO-ARGOS-038), transition, and viewing — for both operator and technician roles
4. The technician's complete field checklist

## What must be manually prepared before pilot launch

A single technical person, with database access (or comfort adapting `prisma/seed.ts`) and an `OWNER`-level API token, must, once, before the pilot starts:

1. Create (or confirm) the pilot `Organization`.
2. Create the operator's `User` + an `OWNER`/`ADMIN`/`OPERATOR` `Membership`.
3. Create the technician's `User` + a `TECHNICIAN` `Membership` (the WO-ARGOS-037 seed block is a direct template).
4. Create the pilot `Site` (can be done through the real UI, by the operator themselves, once logged in).
5. Create 2–3 `ChargingStation` rows for that site via direct API call.
6. Only if real/simulated OCPP connectivity is desired: provision each station via the OCPP endpoint and relay the resulting credentials to whoever is configuring the connection.

None of this requires a code change, a migration, or a new feature — every capability used above already exists and is already tested. It requires a person, not a sprint.
