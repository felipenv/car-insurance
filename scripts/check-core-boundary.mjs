// Boundary regression check (FR4/AC6).
//
// Proves that the CORE framework-agnostic boundary is enforced by tooling: it
// lints the negative-example fixture through the repo's real ESLint config and
// asserts the forbidden web import is reported as an error. Exit 0 only when
// the violation is correctly caught; non-zero otherwise.
//
// Wired into `pnpm lint`, so a normal lint run both proves the baseline is
// clean (`eslint .`) AND proves the boundary actually rejects a web import.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const fixturePath = fileURLToPath(
  new URL(
    "../packages/core/__fixtures__/web-import.fixture.ts",
    import.meta.url,
  ),
);

// The rule is scoped to `packages/core/**/*.ts`, so lint the fixture text under
// a real CORE path. Using lintText (rather than lintFiles) keeps the fixture
// out of the normal `eslint .` pass while still applying the CORE config to it.
const probePath = fileURLToPath(
  new URL("../packages/core/src/__boundary_probe__.ts", import.meta.url),
);

const RULE_ID = "@typescript-eslint/no-restricted-imports";

function fail(message) {
  console.error(`✖ CORE boundary check FAILED: ${message}`);
  process.exit(1);
}

const code = await readFile(fixturePath, "utf8");
const eslint = new ESLint({ cwd: repoRoot });
const [result] = await eslint.lintText(code, { filePath: probePath });

if (!result) {
  fail("ESLint returned no result for the boundary fixture.");
}

const boundaryErrors = result.messages.filter(
  (m) => m.ruleId === RULE_ID && m.severity === 2,
);

if (boundaryErrors.length === 0) {
  fail(
    `expected rule "${RULE_ID}" to reject the web import in ` +
      "packages/core/__fixtures__/web-import.fixture.ts, but no error was " +
      "reported. The framework-agnostic boundary is not being enforced.",
  );
}

console.log(
  `✓ CORE boundary enforced: web import rejected by "${RULE_ID}" ` +
    `(${boundaryErrors.length} error(s) on the fixture).`,
);
