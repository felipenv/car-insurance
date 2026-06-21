# Contributing

Conventions for the car-insurance monorepo. Follow these so the
[green baseline](./README.md#green-baseline) stays reproducible and later
features don't re-litigate workspace layout or tooling.

## Workspace layout

A pnpm-workspace TypeScript monorepo. Members live under `packages/*` (see
`pnpm-workspace.yaml`):

- `packages/core` (`@car-insurance/core`) — framework-agnostic library.
- `packages/web` (`@car-insurance/web`) — UI package; may depend on CORE, never
  the reverse.

Shared conventions are defined once at the root and inherited per package:

- `tsconfig.base.json` — shared compiler options; each package's `tsconfig.json`
  extends it.
- `eslint.config.mjs` — one flat config lints every package.
- `.prettierrc` — formatting style.
- The root `package.json` `scripts` fan out to the packages (`pnpm -r`); CI runs
  these same root scripts.

## Package naming

Packages are scoped under `@car-insurance/<name>` and the directory matches the
unscoped name (`packages/core` → `@car-insurance/core`). All packages are
`private` (nothing is published to an external registry) and ship ESM
(`"type": "module"`).

## Adding a new package

1. Create `packages/<name>/` with a `package.json`. Mirror an existing package:
   - `"name": "@car-insurance/<name>"`, `"version": "0.0.0"`, `"private": true`,
     `"type": "module"`.
   - `scripts`: `build` (`tsc -b`), `typecheck` (`tsc -b`), `test`
     (`vitest run`) — the names the root scripts fan out to.
2. Add `packages/<name>/tsconfig.json` that `extends` `../../tsconfig.base.json`
   and sets `rootDir: "src"` / `outDir: "dist"`. If the package depends on
   another workspace package, add a project `references` entry pointing at it
   (as `packages/web` references `../core`).
3. Register the package in the root solution config (`tsconfig.json`
   `references`) so `tsc -b` builds it in dependency order.
4. Add `packages/<name>/src/index.ts` plus at least one `src/**/*.test.ts` so
   the test path is wired.
5. Add a `vitest.config.ts` that includes `src/**/*.test.ts` (copy an existing
   package's).
6. Declare workspace dependencies with `workspace:*` (e.g.
   `"@car-insurance/core": "workspace:*"`).
7. Run `pnpm install` to update `pnpm-lock.yaml`, then verify the green baseline
   locally: `pnpm build && pnpm lint && pnpm format:check && pnpm test`.

## CORE framework-agnostic rule

Nothing under `packages/core` may import a web/UI framework (React, Vue,
Angular, Svelte, Solid, Preact, Next, Nuxt, Lit, etc.). This boundary is
enforced by tooling, not just documentation:

1. an ESLint `@typescript-eslint/no-restricted-imports` rule scoped to
   `packages/core/**/*.ts` (catches type-only imports too);
2. pnpm's strict `node_modules` — an undeclared dependency simply won't resolve;
3. CORE's `tsconfig` omits the DOM lib, so browser globals aren't in scope.

`pnpm lint` additionally runs `scripts/check-core-boundary.mjs`, which lints the
negative fixture in `packages/core/__fixtures__/` and fails if a web import is
_not_ rejected — a regression guard for the boundary itself. Keep framework code
in `packages/web`.

## Formatting and lint expectations

- **Format before committing:** run `pnpm format` to apply the Prettier style.
  CI runs `pnpm format:check` and fails if anything is unformatted.
- **Lint clean:** `pnpm lint` must report zero errors across both packages
  (and the CORE boundary check must pass).
- These run identically locally and in CI, so a passing local run mirrors CI.
