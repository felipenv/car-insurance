import { defineConfig } from "vitest/config";

// Minimal Vitest config: run the trivial *.test.ts files under src that prove
// the test path is wired (including the import of CORE). Test files are
// excluded from the `tsc -b` build (see tsconfig.json).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
