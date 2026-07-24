# @mediafox/forge-cli

Internal scaffolding CLI for the MediaFOX Forge monorepo. Generates new workspace packages that already match the repository's existing conventions, instead of every new package starting as a hand-copied `package.json`.

This is intentionally small today — one command. It's structured (`forge <noun> <verb>`, via [commander](https://github.com/tj/commander.js)) so new generators (`forge module create`, `forge component create`, ...) are additive, not a rewrite.

## Usage

From the repo root:

```bash
pnpm forge package create <name>
pnpm forge package create billing-core --description "Shared billing domain types"
```

This creates `packages/<name>/` with `package.json`, `tsconfig.json`, `README.md`, and `src/index.ts`, following the exact pattern already used by `packages/core-domain` and `packages/shared-types` — dist-based build output, `@mediafox/typescript-config` as the compiler baseline, `workspace:*` internal dependencies. If that convention ever changes, update `src/templates/package.ts` to match — the templates mirror the convention, they don't define it.

After scaffolding, run `pnpm install` (to link the new workspace package) and `pnpm --filter @mediafox/<name> typecheck` to confirm it compiles.

## What this deliberately does not do

- No dependency injection of business types, no domain assumptions — the generated package is an empty, valid shell.
- Doesn't run `pnpm install` or `git add` for you — scaffolding is a pure filesystem operation; the next steps are printed, not executed automatically, so you can review the output before it touches the lockfile or git index.

## Development

```bash
pnpm --filter @mediafox/forge-cli dev -- package create <name>   # run from source via tsx
pnpm --filter @mediafox/forge-cli test                            # vitest, exercises the scaffolder against a temp dir
pnpm --filter @mediafox/forge-cli build                           # compile to dist/ (what `pnpm forge` actually runs)
```
