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
