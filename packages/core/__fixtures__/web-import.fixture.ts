// NEGATIVE EXAMPLE — intentionally violates the CORE framework-agnostic
// boundary (FR4/AC6). This file is NOT part of the build, tests, or the normal
// lint pass: it lives outside `src/` (so tsc/vitest ignore it) and matches the
// `**/__fixtures__/**` ignore in eslint.config.mjs.
//
// It exists so `scripts/check-core-boundary.mjs` can lint it through the CORE
// rule set and assert that the web import below is rejected. If you ever delete
// the boundary rule, that check — wired into `pnpm lint` — goes red.
//
// (Belt-and-suspenders: even without this lint rule, pnpm's strict node_modules
// would refuse to resolve `react` here, since CORE never declares it.)

import { createElement } from "react";

export const broken = createElement;
