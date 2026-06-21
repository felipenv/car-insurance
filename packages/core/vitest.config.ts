import { defineConfig } from "vitest/config";

// Minimal Vitest config: run the trivial *.test.ts files under src that prove
// the test path is wired. Test files are excluded from the `tsc -b` build (see
// tsconfig.json), so they live alongside source without polluting dist.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
