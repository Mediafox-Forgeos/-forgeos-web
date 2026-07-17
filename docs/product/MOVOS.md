# MOVOS

**Official name:** MOVOS
**Meaning:** Mobility Operating System
**Product owner:** MediaFOX Forge
**Pilot customer:** Kylum Energy

---

## Positioning

MOVOS is the commercial, white-label SaaS platform for electric-vehicle charging
infrastructure management. It is **API-first, multi-tenant, multi-operator,
multi-language, multi-currency, and AI-native**. MediaFOX Forge builds and owns
MOVOS as a product; individual charging operators (such as Kylum Energy) consume
it as tenants.

Where the internal EV Platform project (`projects/ev-platform` in ForgeOS) is the
*program*, MOVOS is the *commercial product name and application* that program
produces. The `apps/movos-web` application is the operator-facing web console.

---

## Relationship with ForgeOS and Forge Labs

| Product     | Audience              | Nature                                   |
| ----------- | --------------------- | ---------------------------------------- |
| ForgeOS     | MediaFOX Forge team   | Internal AI software-factory workspace   |
| Forge Labs  | MediaFOX Forge team   | Internal research and tooling            |
| **MOVOS**   | External operators    | Commercial white-label EV SaaS           |

- ForgeOS tracks MOVOS as the `ev-platform` project and links out to the running
  MOVOS app (`NEXT_PUBLIC_MOVOS_URL`, default `http://localhost:3002`).
- MOVOS is a standalone Next.js 15 application in the same pnpm monorepo. It
  reuses the shared design-token and tooling patterns (Tailwind, Prettier,
  strict TypeScript, ESLint) but defines its own brand palette.

---

## Kylum pilot boundary

Kylum Energy is the **first pilot customer**, not the product owner. The pilot
relationship is intentionally contained:

- All Kylum-specific branding lives in a single file: `src/config/tenant.ts`.
  Swapping that object re-skins the whole application for another operator.
- No Kylum identifiers are spread across components, routes, or data models.
- All in-app data is clearly labeled **"Datos de demostración"** / **"Entorno
  piloto"**. There is no production data and no persistence in this foundation.

---

## Module map (`apps/movos-web`)

| Route                     | Module (ES)     | Purpose                                            |
| ------------------------- | --------------- | -------------------------------------------------- |
| `/dashboard`              | Resumen         | Operations command center (metrics, alerts, feed)  |
| `/sites`, `/sites/[id]`   | Sitios          | Physical locations; per-site tabs                  |
| `/stations`              | Estaciones      | Charger groupings and availability                 |
| `/chargers`, `/chargers/[id]` | Cargadores | Charger inventory and per-unit detail              |
| `/connectors`            | Conectores      | Individual connection points                       |
| `/sessions`, `/sessions/[id]` | Sesiones   | Charging session history and detail                |
| `/users`                 | Usuarios        | Operator directory (no auth yet)                   |
| `/tariffs`               | Tarifas         | Pricing models (COP)                               |
| `/alerts`                | Alertas         | Operational incidents (demo state toggle)          |
| `/reports`               | Reportes        | Report catalogue (generation pending)              |
| `/settings`              | Configuración   | Org, white-label brand, currency, locale, OCPP…    |

**Data domains (typed, strict):** organization, site, station, charger,
connector, session, user, tariff, alert, activity, metrics.

**UI convention:** all visible text is Spanish; code, types, and routes are
English.

---

## Operational foundation (Mission 006)

The first operational vertical slice is implemented in `apps/movos-api`
(NestJS + Prisma + PostgreSQL):

- **Real authentication.** Email/password login, logout, rotating refresh
  tokens (httpOnly cookie), `/auth/me`, and organization selection. Access
  tokens are held in memory on the web client; refresh tokens are httpOnly.
- **Multi-tenant isolation.** Organizations, memberships, and roles. Every
  tenant-scoped request re-validates ACTIVE membership server-side and is
  additionally org-scoped in the query layer.
- **Persistent Sites.** Sites are stored in PostgreSQL (create, list, detail,
  update, archive) with role-based permissions and audit events.
- **Protected web routes.** MOVOS Web gates routes via middleware and integrates
  a login page, auth context, and an API client with silent token refresh.

See `docs/architecture/MOVOS_PLATFORM_FOUNDATION.md` and
`docs/adr/ADR-0006-movos-api-and-tenancy.md`.

The remaining domains below are still demo-only pending future missions.

## Google Maps Location Capability (Mission 007A)

Sites now support Google-assisted address resolution and coordinate validation:

- **Autocomplete search.** Operators type a free-text address and receive real-time
  suggestions from the Google Places API (proxied through the MOVOS API — no key
  ever reaches the browser for server-side calls).
- **Structured address components.** Selecting a suggestion auto-populates
  `formattedAddress`, `addressLine1`, `city`, `state`, `postalCode`,
  `countryCode`, and `googlePlaceId` on the Site.
- **Interactive map.** A draggable marker lets operators fine-tune the operational
  GPS point. Dragging sets `locationSource: MANUAL_ADJUSTMENT` so the system knows
  the postal address and the operational pin may differ.
- **Graceful degradation.** Both API keys are optional. Without the server key the
  autocomplete falls back to plain-text input; without the browser key the map tile
  is replaced by a placeholder.
- **Reusable `LocationPicker`.** The `<LocationPicker>` component is self-contained
  and can be dropped into any future form that needs address + coordinate capture.

See `docs/architecture/MOVOS_LOCATION_CAPABILITY.md` and
`docs/adr/ADR-0007-google-maps-location-capability.md`.

## Known constraints

- **Partial backend.** Auth, organizations, memberships, and Sites persist via
  `apps/movos-api`. The other domains (stations, chargers, connectors, sessions,
  tariffs, alerts) remain centralized demo data under `src/data/`.
- **No live OCPP.** Charger remote actions (Reiniciar, Desbloquear conector,
  Cambiar disponibilidad, Actualizar firmware) are rendered but disabled with the
  message "Disponible cuando se conecte el servicio OCPP."
- **No report generation.** Report cards show "Próximamente" with disabled
  downloads.
- **Static params.** Detail routes are generated from demo data via
  `generateStaticParams`.

---

## Deferred decisions

- OCPP backend selection and CSMS integration (protocol version, endpoint,
  message model).
- Persistence for the remaining domains (stations, chargers, connectors,
  sessions, tariffs, alerts). Sites are already persisted.
- Hardening of the auth foundation: rate limiting, email verification, MFA,
  CSRF tokens, and password reset.
- Billing / roaming integrations.
- Report generation pipeline and export formats.
- Live telemetry and websocket updates for session/charger state.

---

*Owner: ATLAS | Coordination: ARGOS | Build authority: VULCAN*
