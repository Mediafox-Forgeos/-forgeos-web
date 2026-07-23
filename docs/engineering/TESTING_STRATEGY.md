# Testing Strategy

_Owner: VULCAN_

This document describes what testing exists today, what it actually verifies, and what's deliberately not covered yet. It's a description of current state, not a target — update the "Gaps" section as gaps close rather than leaving it stale.

---

## What exists today

| Layer              | Tool                         | Where                                                   | Enforced in CI                                                                             |
| ------------------ | ---------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Backend unit tests | Jest + ts-jest               | `apps/movos-api/src/**/*.spec.ts`                       | Yes — `pnpm test`                                                                          |
| Backend e2e tests  | Jest (`jest-e2e.json`)       | `apps/movos-api/test/*.e2e-spec.ts`                     | **No** — needs a live database, no environment to run it in today                          |
| Frontend tests     | —                            | —                                                       | No test framework configured in any Next.js app (`forgeos-web`, `forge-labs`, `movos-web`) |
| Type safety        | `tsc --noEmit` per package   | every `apps/*`, `packages/*` with a `typescript` config | Yes — `pnpm typecheck`                                                                     |
| Static analysis    | ESLint (flat config) per app | every app                                               | Yes — `pnpm lint`                                                                          |
| Formatting         | Prettier                     | every app + root                                        | Enforced via pre-commit hook (`lint-staged`), not a separate CI step                       |

### Backend unit tests — what they actually verify

Four suites, 35 tests, all mocking `PrismaService` directly (no live database, no test containers):

- `auth.service.spec.ts` — login, refresh rotation, revocation, session lifecycle.
- `sites.service.spec.ts` — CRUD, slug uniqueness/collision handling, org-scoped isolation logic.
- `slugify.spec.ts` — pure function, edge cases.
- `location.service.spec.ts` — Google Places adapter behavior, including two security-focused cases (no raw Google payload or API key ever returned to the client).

Because these mock the database layer, **they verify business logic in isolation, not the actual Prisma queries, not real multi-tenant isolation under concurrent access, and not the guard chain end-to-end.** That's what the e2e specs exist for — see below.

### e2e specs — real but not running anywhere

`auth.e2e-spec.ts` and `tenant-isolation.e2e-spec.ts` exist, are presumably correct in intent (they test real HTTP requests against a running app + real database), but **have no environment to execute in today** — no CI database service, no documented local e2e workflow. They are effectively dead code until one of those exists. Treat any claim of "e2e coverage" for this repo as false until this is resolved.

---

## Gaps (ranked by what would hurt most first)

1. **Zero frontend tests**, across all three Next.js apps. Not even a smoke test that the app renders. Highest-risk gap given `movos-web` is the actual product surface.
2. **e2e specs don't run anywhere.** Two options going forward: (a) add a Postgres service container to a dedicated CI job and wire the e2e specs in, or (b) delete them if they're stale enough that fixing them is more work than rewriting. Don't leave them in this in-between state indefinitely — dead test files erode trust in the rest of the suite.
3. **No coverage threshold.** `jest.config.js` has `collectCoverageFrom` but no `coverageThreshold` — coverage can silently drop and nothing will notice.
4. **No component/integration testing library chosen** for the frontend apps (React Testing Library, Playwright, or similar) — this is a decision, not just missing config, and belongs with whoever owns frontend engineering standards.

---

## What NOT to do about these gaps without a decision

Adding a testing framework to a Next.js app, or standing up a CI database for e2e, are real technical choices with tradeoffs (unit vs. integration bias, Playwright vs. Cypress, testcontainers vs. a hosted CI Postgres). They're deliberately **not** included in this pass of engineering-foundation work — they cross from "pure tooling" into "how do we want to test this specific product," which is closer to an architectural decision than a DX fix. Flag it for whoever owns that call; don't guess at it here.

---

## Related

- [CI/CD Playbook](./CI_CD_PLAYBOOK.md)
