# car-insurance

Illustrative car-insurance premium estimator (PDLC factory demo).

A pnpm-workspace TypeScript monorepo with two packages:

- `packages/core` (`@car-insurance/core`) — framework-agnostic library (future
  rating engine + model).
- `packages/web` (`@car-insurance/web`) — UI package (future quote form); may
  depend on CORE, never the reverse.

## Getting started

Requires Node 22+ and pnpm (provisioned via corepack — `corepack enable`).

```sh
pnpm install --frozen-lockfile
```

## Scripts

Run from the repo root; they cover both packages.

| Script              | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `pnpm build`        | Compiles both packages (`tsc -b`, CORE before WEB).     |
| `pnpm typecheck`    | Type-checks both packages.                              |
| `pnpm lint`         | ESLint over the repo + the CORE boundary check (below). |
| `pnpm format`       | Rewrites files to the Prettier style.                   |
| `pnpm format:check` | Verifies formatting without writing (used in CI).       |
| `pnpm test`         | Runs the Vitest suites in both packages.                |

## Conventions

- **Formatting:** Prettier (`.prettierrc`). The committed baseline conforms;
  CI runs `pnpm format:check`.
- **Linting:** one flat config (`eslint.config.mjs`) lints both packages.
- **CORE is framework-agnostic.** Nothing under `packages/core` may import a
  web/UI framework. This is enforced by tooling, not convention:
  1. an ESLint `no-restricted-imports` rule scoped to `packages/core/**`;
  2. pnpm's strict `node_modules` (an undeclared dependency won't resolve);
  3. CORE's `tsconfig` omits the DOM lib, so browser globals aren't in scope.

  `pnpm lint` also runs `scripts/check-core-boundary.mjs`, which lints a
  deliberately-broken fixture (`packages/core/__fixtures__/`) and fails if a web
  import is _not_ rejected — a regression guard for the boundary itself.

## Green baseline

The baseline is "green" when, from a fresh clone, the documented commands all
succeed with no errors:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm format:check
pnpm test
```

CI (`.github/workflows/ci.yml`) runs exactly these steps on every push and pull
request to `main`, so a passing local run mirrors a passing CI run. This green
signal gates the start of downstream features; keep it green.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to add a package and the
conventions later features follow.
