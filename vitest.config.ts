import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The e2e specs are Playwright's; Vitest would try to run them and fail on
    // an import it does not provide.
    exclude: ["e2e/**", "node_modules/**"],
    // Bounded on purpose. The suite is pure-function only, but a runaway test
    // should fail rather than take the editor down with it: two workers, a
    // per-file timeout, and no watch mode in CI.
    pool: "threads",
    poolOptions: { threads: { maxThreads: 2, minThreads: 1 } },
    testTimeout: 5_000,
    hookTimeout: 5_000,
    reporters: ["dot"],
  },
});
