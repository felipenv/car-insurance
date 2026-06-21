// Flat ESLint config for the car-insurance monorepo.
//
// One root config lints both packages in a single `eslint .` invocation. The
// notable, product-mandated rule is the CORE framework-agnostic boundary
// (FR4/AC6): nothing under packages/core may import a web/UI framework. That
// boundary is enforced belt-and-suspenders — this lint rule plus pnpm's strict
// node_modules (an undeclared dependency simply won't resolve). CORE's tsconfig
// also omits the DOM lib, so browser globals aren't even in scope there.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

/**
 * Import specifiers that pull in a web/UI framework. Forbidden inside CORE.
 * Globs match both the bare package and its subpath/scoped entry points.
 */
const WEB_FRAMEWORK_IMPORTS = [
  "react",
  "react-dom",
  "react/*",
  "react-dom/*",
  "vue",
  "vue/*",
  "@vue/*",
  "@angular/*",
  "svelte",
  "svelte/*",
  "@sveltejs/*",
  "solid-js",
  "solid-js/*",
  "preact",
  "preact/*",
  "next",
  "next/*",
  "nuxt",
  "nuxt/*",
  "lit",
  "lit/*",
  "@lit/*",
  "@stencil/*",
  "alpinejs",
  "jquery",
  "@hotwired/*",
];

const CORE_BOUNDARY_MESSAGE =
  "CORE must stay framework-agnostic (FR4): web/UI framework imports are not " +
  "allowed in packages/core. Keep framework code in packages/web.";

export default tseslint.config(
  // Build output, coverage, and the intentionally-broken boundary fixture are
  // not linted as part of the normal baseline.
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/*.tsbuildinfo",
      "**/__fixtures__/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // This is a Node-targeted tooling baseline (no browser code yet); give every
  // file the Node globals so config/script files lint cleanly.
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // The CORE framework-agnostic boundary. Scoped to packages/core sources only.
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      // Defer entirely to the typescript-eslint variant so type-only imports
      // (`import type ... from "react"`) are caught too.
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: WEB_FRAMEWORK_IMPORTS,
              message: CORE_BOUNDARY_MESSAGE,
            },
          ],
        },
      ],
    },
  },

  // Keep ESLint out of Prettier's lane: disable stylistic rules that would
  // conflict with the formatter. Must stay last.
  prettier,
);
