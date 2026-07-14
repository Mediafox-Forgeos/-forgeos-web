# Forge Labs

Forge Labs is the AI-powered tooling layer of MediaFOX Forge. It provides standalone applications that founders, product managers, branding teams, and AI agents use to make high-quality decisions faster.

Forge Labs lives at `apps/forge-labs/` in the monorepo and runs as a separate application from ForgeOS. It is accessible from the ForgeOS sidebar.

## Available Modules

| Module | Status | Description |
| --- | --- | --- |
| [Naming Engine](naming-engine/README.md) | **Live** | Generate, score, and analyze technology brand names |
| PRD Generator | Coming Soon | AI-assisted Product Requirements Documents |
| Architecture Review | Coming Soon | Structured review of system architecture proposals |
| ADR Builder | Coming Soon | Architecture Decision Record authoring assistant |
| Risk Analyzer | Coming Soon | Risk surface mapping for product and engineering decisions |
| Prompt Studio | Coming Soon | Structured prompt development and testing environment |

## Local Development

Forge Labs runs on port 3001 by default. ForgeOS links to it via the sidebar.

```bash
# From monorepo root
pnpm --filter @mediafox/forge-labs dev

# Or from the app directory
cd apps/forge-labs
pnpm dev
```

Access at `http://localhost:3001`.

## Architecture

Forge Labs is a standalone Next.js application that consumes `@mediafox/naming-engine` as a workspace package. All generation and scoring logic lives in the package. The application layer only handles presentation and user interaction.

```
packages/naming-engine/   ← Engine logic (source of truth)
apps/forge-labs/          ← Web application (presentation only)
```

See [naming-engine/Architecture.md](naming-engine/Architecture.md) for technical details.

## Deployment

Forge Labs deploys as a separate Vercel project with `Root Directory: apps/forge-labs`.

Set `NEXT_PUBLIC_FORGEOS_URL` to the production ForgeOS URL to enable the "Back to ForgeOS" navigation link.
