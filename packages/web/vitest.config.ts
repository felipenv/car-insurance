import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// WEB is a React app, so component tests run in a jsdom DOM environment and the
// React plugin compiles JSX/TSX. Tests live in *.test.ts(x) under src and are
// excluded from the `tsc -b` build (see tsconfig.json). The setup file wires
// Testing Library's after-each cleanup so tests don't leak DOM between cases.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
