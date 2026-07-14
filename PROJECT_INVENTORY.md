# ForgeOS — Project Inventory

> Technical snapshot created on 2026-07-13 from commit `583ba8aaccc311d6a124cde047f1e11d0e91f969` (`feat(forgeos): create operational workspace for EV Platform`).
>
> Scope: repository inspection only. This document records observed state; it introduces no application, configuration, or behavior changes.

## 1. Executive summary

ForgeOS is an early-stage, static Next.js application that presents an AI operating workspace for MediaFOX Forge. Its primary surface is ARGOS, supported by workspace, project, client, roadmap, decision, knowledge, and settings views.

The codebase is compact, type-safe, and visually consistent. It has a clear UI composition layer and typed local fixture data, but it does **not** yet have a backend, persistence, real authentication, API routes, server actions, tests, CI configuration, or a defined domain/integration layer. The current login and ARGOS interaction are UI-only.

## 2. Repository snapshot

| Property | Observed state |
| --- | --- |
| Git branch | `main` tracking `origin/main` |
| Current commit | `583ba8a` — `feat(forgeos): create operational workspace for EV Platform` |
| Package | `forgeos-alpha` `0.1.0`, private |
| Package manager | pnpm `11.5.3` declared; lockfile format `9.0` |
| Runtime framework | Next.js App Router, resolved to `15.5.20` |
| UI runtime | React / React DOM, resolved to `19.2.7` |
| Language | TypeScript with `strict: true` |
| Styling | Tailwind CSS 3.4, CSS variables, dark-mode class strategy |
| Component baseline | shadcn/ui-compatible configuration, locally implemented primitives |
| Icons | `lucide-react` |
| Deployment config in repo | None (`vercel.json`, Dockerfile, and GitHub Actions are absent) |

The repository contains no tracked environment files, API keys, or deployment-specific configuration. `.env*.local` is ignored.

## 3. Build and quality toolchain

### Commands

| Command | Definition | Purpose |
| --- | --- | --- |
| `pnpm dev` | `next dev` | Local development server |
| `pnpm build` | `next build` | Production compilation and static generation |
| `pnpm start` | `next start` | Runs a production build locally |
| `pnpm lint` | `eslint .` | ESLint validation |
| `pnpm typecheck` | `tsc --noEmit` | TypeScript validation |
| `pnpm format` | `prettier --write .` | Applies formatting |
| `pnpm format:check` | `prettier --check .` | Verifies formatting |

### Tool configuration

- ESLint 9 uses a flat configuration with `FlatCompat` to consume the Next.js core-web-vitals and TypeScript presets.
- Prettier uses the Tailwind class-sort plugin, single quotes, semicolons, two-space indentation, and trailing commas.
- TypeScript uses bundler module resolution, the `@/*` alias, strict checking, incremental metadata, and Next's TypeScript plugin.
- `pnpm-workspace.yaml` explicitly allows native build scripts for `sharp` and `unrs-resolver`; this was added to satisfy the installation behavior used by deployment environments.
- No unit, component, end-to-end, visual regression, or accessibility test framework/configuration is tracked.
- No CI workflow is tracked under `.github/`.

## 4. Application architecture

### Route structure

| Route | Component | Behavior |
| --- | --- | --- |
| `/` | `app/page.tsx` | Server-side redirect to `/argos` |
| `/login` | `app/login/page.tsx` | Static login form; no submit handler or authentication integration |
| `/argos` | `app/(workspace)/argos/page.tsx` | ARGOS executive console |
| `/workspace` | `app/(workspace)/workspace/page.tsx` | Current sprint and operational focus |
| `/projects` | `app/(workspace)/projects/page.tsx` | EV Platform project listing |
| `/projects/ev-platform` | `app/(workspace)/projects/ev-platform/page.tsx` | EV Platform detail view |
| `/clients` | `app/(workspace)/clients/page.tsx` | Kylum Energy pilot-client view |
| `/roadmap` | `app/(workspace)/roadmap/page.tsx` | Four-phase product roadmap |
| `/decisions` | `app/(workspace)/decisions/page.tsx` | ADR list and UI-only creation control |
| `/knowledge` | `app/(workspace)/knowledge/page.tsx` | Knowledge categories and empty states |
| `/settings` | `app/(workspace)/settings/page.tsx` | Placeholder settings surface |

The `(workspace)` route group provides a shared layout through `WorkspaceShell`; it does not affect public URL paths. `/login` remains outside that shell.

### Rendering and state boundaries

- Pages are server components by default.
- `AppSidebar` is a client component because it reads pathname and controls the mobile drawer.
- `ArgosComposer` is a client component because it stores message/submission state.
- There are no API routes, route handlers, server actions, data fetching calls, databases, queues, or external service clients.
- Current production output is static/prerenderable for all application routes.

### Layout and navigation

- `WorkspaceShell` renders the sidebar beside the main content at `lg` breakpoints.
- `AppSidebar` becomes a fixed, closable drawer on smaller screens.
- Sidebar navigation covers ARGOS, Workspace, Projects, Clients, Roadmap, Decisions, Knowledge, and Settings.
- The active-route rule handles `/projects/*` descendants; all other items use exact pathname equality.

## 5. Source layout

```text
app/
  (workspace)/                 Shared operational route group
    argos/                      ARGOS console
    clients/                    Pilot client view
    decisions/                  ADR view
    knowledge/                  Knowledge categories
    projects/                   Project list and EV Platform detail
    roadmap/                    Product roadmap
    settings/                   Settings placeholder
    workspace/                  Sprint workspace
  login/                        Static login UI
  globals.css                   Design tokens and global Tailwind layers
  layout.tsx                    Root document/metadata layout
  page.tsx                      Redirect to ARGOS
components/
  forgeos/                      Domain-facing reusable presentation components
  layout/                       Sidebar, page header, workspace shell
  ui/                           Base Button, Card, Input primitives
data/                           Typed local mock/fixture data by domain
features/                       Domain placeholders only (README files)
hooks/                          `useIsMobile`, currently unused
lib/                            `cn` class-name utility
styles/                         Placeholder README; no additional style modules
types/                          Shared TypeScript domain/view-model types
```

## 6. UI system and reusable components

### Design language

- Dark theme is forced at the document root with `className="dark"`.
- Colors are HSL CSS variables defined in `app/globals.css`: background, foreground, card, muted, accent, border, input, and ring.
- Typography uses an Inter-first system stack. Inter is not bundled through `next/font`; it depends on local availability or fallback fonts.
- Radius tokens are centralized in Tailwind configuration.
- The implementation intentionally favors muted borders and neutral cards over gradients and prominent shadows. One older login card still uses a large shadow utility.

### Base UI primitives

| Component | Responsibility |
| --- | --- |
| `Button` | CVA-backed button variants (`default`, `secondary`, `ghost`, `outline`) and sizes |
| `Card` | Base bordered dark surface |
| `Input` | Standard styled input field |
| `cn` | `clsx` + `tailwind-merge` utility |

### Workspace components

| Component | Used by | Responsibility |
| --- | --- | --- |
| `ActivityFeed` | ARGOS, Workspace, EV Platform | Renders typed activity entries |
| `ArgosComposer` | ARGOS | Prompt textarea, attachment UI, quick actions, local submission acknowledgement |
| `ClientCard` | Clients | Displays Kylum and its pilot/customer boundary |
| `MetricCard` | ARGOS | Displays executive status items |
| `ProjectCard` | Projects | Navigates to `/projects/ev-platform` |
| `SprintProgress` | Workspace | Derives completion ratio from sprint task booleans |
| `StatusBadge` | Projects, Clients, Roadmap, Decisions | Maps status tone to a visual badge |
| `PageHeader` | All workspace pages | Shared eyebrow/title/description/action header |
| `WorkspaceShell` | Workspace route group | Shared sidebar/main shell |
| `AppSidebar` | Workspace shell | Desktop sidebar and mobile navigation drawer |

## 7. Data model and current data source

All visible business data is currently local, static, and typed. There is no runtime data source.

### Shared types

`types/index.ts` defines `Status`, `ActivityItem`, `Metric`, `Sprint`, `SprintTask`, `Project`, `Client`, `RoadmapPhase`, `Decision`, and `KnowledgeCategory`, alongside navigation support types. No application source uses `any`.

### Fixture modules

| File | Contents |
| --- | --- |
| `data/argos.ts` | ARGOS quick actions, six executive metrics, recent activity |
| `data/workspace.ts` | Sprint 01, seven tasks, next milestones, workspace activity |
| `data/projects.ts` | The single EV Platform project and its activity |
| `data/clients.ts` | The single Kylum Energy client |
| `data/roadmap.ts` | Foundation, Core Platform, OCPP, and Pilot phases |
| `data/decisions.ts` | ADR-0001 through ADR-0004 |
| `data/knowledge.ts` | Six knowledge categories |

The sole project is **EV Platform** and the sole client is **Kylum Energy**. The client page correctly represents the intended boundary: Kylum is the pilot customer, not the product.

## 8. Functional status by area

| Area | Present behavior | Missing operational behavior |
| --- | --- | --- |
| ARGOS | Composer UI, quick-action fill, local acknowledgement, executive status | Agent endpoint, streaming, conversation persistence, tools/actions, authorization |
| Workspace | Sprint task display; progress derived from task flags | Sprint CRUD, ownership, dates, backend synchronization |
| Projects | Single project and detail sections | Project model persistence, roadmap/backlog/risk records, editable state |
| Clients | Single pilot-client display | Client records, contacts, relationship model, permissions |
| Decisions | ADR list and visible “New Decision” button | Create/detail/edit workflows, immutable ADR history, approvals |
| Knowledge | Category cards and empty states | Documents, search, ingestion, retrieval, permissions |
| Login | Styled email/password form | Validation, session creation, password flow, route protection |
| Settings | Informational placeholder | Configuration model, account/workspace management |

## 9. Security and operations posture

- Authentication is absent. `/login` is a non-submitting visual form and workspace routes are public.
- Authorization, multi-tenancy enforcement, user identity, session storage, and audit logs are absent.
- No environment-variable contract or runtime validation is present.
- No server-side mutation endpoints exist, so there is no current application-level write attack surface; this will change when backend functionality is introduced.
- There is no in-repository deployment manifest, containerization, telemetry, error tracking, health check, backup strategy, or CI/CD workflow.
- The repository is configured to avoid committing local `.env` files, PNPM store state, build output, and TypeScript incremental artifacts.

## 10. Observed technical risks and constraints

These are observations, not implementation instructions.

1. **No durable domain layer** — business state is duplicated only as static display fixtures. Any operational feature requires a persistence model and data-access boundary first.
2. **No authentication or tenant boundary** — the stated multi-tenant product direction is not represented in the application architecture yet.
3. **No automated test or CI safety net** — regression confidence currently depends on local lint/typecheck/build execution.
4. **ARGOS is a UI simulation** — submitting a message only changes in-memory client state; it does not call a model or service.
5. **UI/data coupling on ARGOS metrics** — the metric icon array is positional in `app/(workspace)/argos/page.tsx`; adding/reordering metrics can silently produce a mismatched icon without a typed association.
6. **Feature folders are placeholders** — `features/argos`, `features/clients`, and `features/projects` only contain README files. The active implementation is organized by `app`, `components`, and `data` instead.
7. **Unused code** — `hooks/use-mobile.ts` is tracked but not imported by application code. `styles/` contains only a README.
8. **Localization is mixed** — root metadata and login are Spanish, while operational workspace copy is primarily English. No locale or translation framework is present.
9. **Design-token portability** — Inter is declared as a CSS font family rather than loaded/bundled, so rendering varies by host if Inter is not installed.

## 11. Recommended sprint sequencing

1. Establish the domain model and persistence boundary for workspace, project, client, ADR, activity, and tenant identity.
2. Implement authentication and authorization before exposing operational write flows.
3. Define API/route-handler contracts and replace local fixtures incrementally, starting with the active sprint and EV Platform.
4. Define ARGOS orchestration contracts: conversation, tool permissions, context retrieval, and auditability.
5. Add a CI workflow that executes format verification, lint, typecheck, build, and a minimal route smoke test on pull requests.
6. Add test infrastructure before stateful CRUD and agent behavior expand.
7. Move active feature code into explicit domain modules only when the domain model is introduced; avoid speculative folder refactors before then.

## 12. Known commit history

| Commit | Intent |
| --- | --- |
| `583ba8a` | Created the operational workspace for EV Platform |
| `d67149e` | Created the ARGOS command center |
| `37a9d3b` | Allowed required PNPM build scripts for deployment |
| `7a63c7c` | Initialized ForgeOS Alpha |

## 13. Inventory conclusion

ForgeOS has a sound visual and route-level foundation for an operational workspace, with concise shared components and strict TypeScript. The next architectural inflection point is not another presentation refactor: it is the introduction of authenticated, tenant-aware domain data and an auditable ARGOS integration boundary.
