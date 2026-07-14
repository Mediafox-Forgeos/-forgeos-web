# ForgeOS pnpm monorepo

## Why this monorepo exists

ForgeOS is becoming the workspace around which MediaFOX Forge products, services, shared domain contracts, and AI agents will evolve. A pnpm workspace creates a single dependency graph and a deliberate home for code that earns reuse, without forcing the current ForgeOS web application into premature abstractions.

Mission 002 moves the existing Next.js application unchanged into `apps/forgeos-web`. It creates only the boundaries needed to support future work safely.

## Top-level boundaries

```text
apps/
  forgeos-web/        Product UI and Next.js application boundary
packages/
  core-domain/        Framework-independent business concepts
  shared-types/       Stable cross-application contracts
  ui/                 Low-level presentation primitives only
  eslint-config/      Shared framework-neutral lint support
  typescript-config/  Shared strict compiler baselines
docs/
  architecture/       Long-lived technical decisions
```

## Dependency rule

> Applications may depend on packages.  
> Packages must never depend on applications.  
> Core domain must not depend on frameworks or infrastructure.

Allowed dependency direction:

```text
apps/forgeos-web ───────────────► packages/*
packages/ui ────────────────────► packages/shared-types (only when justified)
packages/core-domain ───────────► packages/shared-types (only when justified)
```

No package may import source files from `apps/forgeos-web`. All cross-package consumption must use a package's public root export.

## What belongs in an application

`apps/forgeos-web` owns:

- Next.js routes, layouts, metadata, and App Router configuration;
- page composition and ForgeOS-specific visual components;
- navigation and responsive sidebar behavior;
- presentation-specific view models and local fixtures;
- Tailwind configuration and global application styles;
- Next.js-specific ESLint configuration.

The current `types/` folder remains in the web app because its types model presentation concerns such as cards, page status, and navigation. They are not shared service contracts yet.

## What belongs in a package

### `@mediafox/core-domain`

Future business language shared across ForgeOS, backend services, products, and agents. It must be plain TypeScript with no React, Next.js, database, ORM, API, queue, or infrastructure dependency. Mission 002 deliberately leaves a typed marker only; Mission 003 introduces the first real domain model.

### `@mediafox/shared-types`

Stable contracts with at least two real consumers. Do not move web-only view models here merely to fill the package. It is scaffolded now so a future API or worker has an intentional destination.

### `@mediafox/ui`

Only framework-compatible, low-level primitives that can safely be reused without carrying ForgeOS product context. The current Button, Card, Input, and `cn` helper remain inside ForgeOS because extracting them requires a deliberate shared Tailwind/content strategy. ForgeOS-specific components — ARGOS Composer, Activity Feed, Sprint Progress, Project Card, Client Card, and Workspace Sidebar — remain application code.

### Configuration packages

`@mediafox/typescript-config` provides a strict, framework-neutral base and a small Next.js extension. Applications retain aliases, includes, and framework-specific compiler settings where appropriate.

`@mediafox/eslint-config` currently shares only framework-neutral ignored build directories. ForgeOS keeps Next.js core-web-vitals configuration local to avoid making shared configuration depend on an application framework.

## What must not be shared prematurely

Do not share the following until the dependency is demonstrated by more than one consumer:

- current ForgeOS page models, navigation items, and fixture data;
- business objects that have not been validated by the domain model;
- Next.js layouts, routes, hooks, and Tailwind application styles;
- agent prompts, product screens, or workflow-specific components;
- backend persistence concerns, APIs, and authentication code.

## EV Platform introduction

EV Platform should enter the monorepo only after its domain vocabulary and application boundary are defined. Its initial business concepts may eventually live in `@mediafox/core-domain`; its web or service delivery surfaces should live under `apps/`.

Mission 002 intentionally does not create an EV Platform application, backend, database schema, OCPP integration, or product-specific package. The monorepo is prepared for those additions without implying an architecture before the requirements exist.

## Vercel deployment

ForgeOS now lives at `apps/forgeos-web`. Configure the existing Vercel project with this dashboard setting:

```text
Root Directory: apps/forgeos-web
```

The repository retains the root `pnpm-lock.yaml` and workspace manifest. No `vercel.json`, environment variables, or secrets are needed for the current static Next.js application.
