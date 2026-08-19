import { execFileSync } from "node:child_process";

/**
 * Re-seed the test database before every run.
 *
 * The suite is deliberately allowed to mutate state — the manager scenario
 * suspends a seller and the seller scenario publishes a listing — so it cannot
 * also depend on the previous run having left things tidy. Starting from a fresh
 * seed makes each run independent, and makes a failed run harmless to the next.
 *
 * `--env-file=.env.test` is what keeps this off the demo database. The seed
 * itself connects through DIRECT_URL, which the Neon pooler cannot serve DDL for.
 */
export default function globalSetup() {
  console.log("[e2e] seeding the test database…");

  execFileSync(
    process.execPath,
    ["--env-file=.env.test", "node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"],
    { stdio: "inherit" },
  );
}
