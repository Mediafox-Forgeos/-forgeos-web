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

## Known constraints

- **No backend.** All content is centralized demo data under `src/data/`.
  Nothing persists; alert acknowledge/resolve is a client-only demo toggle.
- **No authentication.** The user module is an operational placeholder.
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
- Persistence layer and multi-tenant data isolation strategy.
- Authentication, authorization, and role enforcement (roles are currently
  presentational).
- Billing / roaming integrations.
- Report generation pipeline and export formats.
- Live telemetry and websocket updates for session/charger state.

---

*Owner: ATLAS | Coordination: ARGOS | Build authority: VULCAN*
