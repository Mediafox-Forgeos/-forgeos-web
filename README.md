# MediaFOX Forge

ForgeOS is the AI operating workspace for MediaFOX Forge. It currently provides the ForgeOS web application and workspace scaffolding for future domain, UI, and configuration packages.

## Monorepo structure

```text
apps/
  forgeos-web/           Next.js ForgeOS application
  naming-engine/         Internal naming engine — generates, scores, and ranks brand names
packages/
  core-domain/           Framework-independent domain boundary (Mission 003 placeholder)
  eslint-config/         Shared framework-neutral ESLint support values
  shared-types/          Reserved cross-application contracts
  typescript-config/     Shared strict TypeScript baselines
  ui/                    Reserved shared low-level UI primitives
docs/
  architecture/          Long-form architecture documents and system design
  adr/                   Architecture Decision Records (indexed, immutable)
  agents/                Agent operating protocols and context contracts
  company/               Founding documents, organizational structure, and principles
  engineering/           Engineering standards, testing strategy, and CI/CD playbooks
  product/               Product vision, roadmaps, and requirements
```

## Prerequisites

- Node.js 20 or newer
- pnpm 11.5.3 (the repository declares its required version)

## Installation

```bash
pnpm install
```

## Local development

Run ForgeOS from the repository root:

```bash
pnpm dev
```

The web application is available at `http://localhost:3000` by default.

## Quality commands

```bash
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
```

Use `pnpm format` to apply formatting.

## Packages

- `@mediafox/forgeos-web`: the ForgeOS Next.js application.
- `@mediafox/naming-engine`: internal naming engine. Generates 500,000+ candidates, scores across 13 dimensions, and produces investor-ready Branding Reports. See [`apps/naming-engine/`](apps/naming-engine/).
- `@mediafox/core-domain`: framework-independent future domain model. It is intentionally a Mission 003 scaffold.
- `@mediafox/shared-types`: future cross-application contracts. ForgeOS view types remain local until another consumer needs them.
- `@mediafox/ui`: future low-level shared primitives. Existing UI primitives remain in ForgeOS to preserve Tailwind behavior during this migration.
- `@mediafox/eslint-config`: shared framework-neutral ESLint support values.
- `@mediafox/typescript-config`: strict TypeScript baselines used by workspace packages.

## Vercel deployment

ForgeOS remains a Next.js application, now located at `apps/forgeos-web`.

In the Vercel project dashboard, configure:

```text
Settings → General → Root Directory: apps/forgeos-web
```

Keep the production branch set to `main`. No repository secrets or environment variables are required by the current application. Vercel should install from the pnpm workspace lockfile and build the selected application directory.

See [the monorepo architecture document](docs/architecture/MONOREPO.md) for package boundaries and dependency rules.

## Company Documentation

MediaFOX Forge institutional documentation — organizational structure, founding principles, engineering standards, product strategy, and agent protocols.

| Section | Description |
| --- | --- |
| [Company](docs/company/README.md) | Founding documents, organizational structure, and operating principles |
| [Architecture](docs/architecture/README.md) | Long-form system design documents |
| [ADR](docs/adr/README.md) | Architecture Decision Records |
| [Engineering](docs/engineering/README.md) | Engineering standards, testing strategy, CI/CD |
| [Product](docs/product/README.md) | Product vision, roadmaps, and requirements |
| [Agents](docs/agents/README.md) | AI agent protocols, context contracts, and behavioral boundaries |

The founding organizational structure, executive roles, engineering principles, and AI collaboration model are defined in the [Founder Team Constitution](docs/company/FOUNDER_TEAM_CONSTITUTION.md).
