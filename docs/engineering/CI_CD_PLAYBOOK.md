# CI/CD Playbook

_Owner: VULCAN_

This document describes the automated quality gates that run on this repository, and the manual steps that still happen outside of them. It reflects what is actually configured today — update it in the same PR whenever the pipeline changes.

---

## What CI does

`.github/workflows/ci.yml` runs on every push to `main` and every pull request targeting `main`:

1. Checkout
2. Install pnpm (version read automatically from `packageManager` in root `package.json`)
3. Install Node (version read from `.nvmrc` — the single source of truth for the Node version this repo targets)
4. `pnpm install --frozen-lockfile`
5. `pnpm lint`
6. `pnpm typecheck`
7. `pnpm test`
8. `pnpm build`

All four quality commands run with `pnpm -r --if-present`, so a package that doesn't define a given script (e.g. `packages/typescript-config` has no `lint` script) is skipped rather than failing the run. A package that _does_ define the script must pass it.

Runs on the same branch/PR cancel in-progress runs when a new commit lands (`concurrency` block), so CI minutes aren't spent validating a commit that's already been superseded.

### Why there's no database service in CI

`movos-api`'s unit tests fully mock `PrismaService` — verified empirically (not assumed) by running the suite with no `.env` file and no live Postgres present; all 35 tests still pass. The `build` step runs `prisma generate`, which only needs `DATABASE_URL` to be a syntactically valid string (Prisma reads the schema file, it doesn't open a connection) — CI provides a placeholder value for exactly this reason. **e2e specs** (`test/*.e2e-spec.ts`) do need a real database and are **not** run in CI today — see the Testing Strategy doc for what that means in practice.

### What CI does not do (yet)

- No deploy step. Deploys to Vercel (`forgeos-web`, `movos-web`) and Railway (`movos-api`) remain manual (`vercel --prod`, `railway deployment up`), per the existing MOVOS deployment docs.
- No Turborepo / affected-package detection — every push runs lint/typecheck/test/build across the whole workspace. Acceptable at the current repo size; revisit if CI time becomes a bottleneck.
- No `coverageThreshold` gate — coverage is measurable (`jest.config.js` has `collectCoverageFrom`) but not enforced.
- No CodeQL / dependency-scanning workflow.

---

## Required local checks before opening a PR

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

These are the exact commands CI runs — running them locally first means the PR should go green on the first try. `pnpm format:check` is not part of CI (pre-commit hooks handle formatting instead, see below) — CI would still catch lint issues if formatting somehow drifted through anyway.

---

## Pre-commit / pre-push automation

Husky manages two git hooks (`.husky/`), wired up automatically by the root `prepare` script whenever `pnpm install` runs:

- **`pre-commit`** runs `lint-staged` (`.lintstagedrc.json`), which runs `prettier --write` on staged files. It deliberately does **not** run ESLint — each app has its own `eslint.config.mjs`, and per-file/per-app config resolution inside a fast pre-commit hook adds real complexity for marginal benefit. ESLint enforcement lives in CI instead, where it already runs correctly per app.
- **`commit-msg`** runs `commitlint` against `commitlint.config.js` (`@commitlint/config-conventional`), enforcing the commit style this repo's history already used organically before it was formalized (`feat`, `fix`, `chore`, `docs`, `refactor`, `ci`).

If a hook is ever a blocker in an emergency, `git commit --no-verify` bypasses it — but that should be rare enough to be notable when it happens, not routine.

---

## Branch / merge conventions

Observed and continued from existing history (`git log --merges`): feature work happens on a topic branch (`type/short-description`, e.g. `chore/tech-001-repository-integrity`), opened as a PR against `main`, merged with a **merge commit** (not squash) so the individual commits inside the PR stay visible in `main`'s history. Use this convention unless a specific PR calls for something else.

---

## Related

- [Testing Strategy](./TESTING_STRATEGY.md)
- [Monorepo package boundaries](../architecture/MONOREPO.md)
