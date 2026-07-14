# ADR-0005: MOVOS is the commercial mobility platform

| Property   | Value                     |
| ---------- | ------------------------- |
| Status     | Approved                  |
| Date       | 2026-07-14                |
| Author     | VULCAN                    |
| Approved   | CEO                       |
| Supersedes | —                         |

## Context

The EV Platform program (ADR-0002, ADR-0003) needed a concrete, commercial
product identity and a standalone operator-facing application. The program was
tracked internally as "EV Platform" but lacked a shipped product name, an app,
and an enforced white-label/pilot boundary. Kylum Energy is the pilot customer,
and there was a risk of pilot-specific concerns leaking into the product.

## Decision

Establish **MOVOS (Mobility Operating System)** as the commercial name of the EV
charging platform and scaffold it as a standalone Next.js 15 App Router
application at `apps/movos-web` (port 3002) within the existing pnpm monorepo.

Key decisions:

1. **White-label by construction.** All tenant/brand configuration is isolated in
   `src/config/tenant.ts`. No customer identifiers appear in components, routes,
   or data models.
2. **Kylum is a pilot tenant, not the owner.** MediaFOX Forge owns MOVOS; Kylum
   consumes it. This is reflected in copy ("Operación piloto") and containment of
   Kylum data to the tenant config.
3. **Foundation is UI + typed demo data only.** Strict TypeScript domain models
   (`src/types`) with centralized demo data (`src/data`), no backend, no auth, no
   live OCPP. All content is labeled "Datos de demostración" / "Entorno piloto".
4. **Reuse existing tooling patterns.** Tailwind tokens, Prettier, strict
   TypeScript baseline, and the shared ESLint config match `apps/forgeos-web`.
   MOVOS defines its own restrained indigo/slate/cyan brand palette distinct from
   ForgeOS.
5. **ForgeOS integration.** ForgeOS references the program as "MOVOS" and links
   out to the running app via `NEXT_PUBLIC_MOVOS_URL`.

## Alternatives Considered

- **Keep EV Platform inside ForgeOS.** Rejected: ForgeOS is an internal tool;
  MOVOS is a commercial product with a separate audience and deployment surface.
- **Build backend/OCPP first.** Rejected: the foundation needs a navigable,
  demonstrable product surface and stable domain contracts before wiring live
  infrastructure.
- **Embed Kylum branding directly.** Rejected: violates the white-label mandate
  (ADR-0002) and the pilot boundary (ADR-0003).

## Consequences

- MediaFOX Forge gains a runnable, operator-facing MOVOS console with clear
  module boundaries and typed domain models.
- Re-skinning for a new operator is a single-file change (`tenant.ts`).
- The monorepo now has three apps (forgeos-web, forge-labs, movos-web) sharing
  tooling.
- Deferred: OCPP/CSMS integration, persistence, auth/roles, billing, report
  generation, and live telemetry (see `docs/product/MOVOS.md`).

## Related

- ADR-0002: EV Platform is White Label
- ADR-0003: Kylum Energy is Pilot Customer
- `docs/product/MOVOS.md`
- `docs/architecture/MONOREPO.md`
