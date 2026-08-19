import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke suite: one scenario per role.
 *
 * Two decisions matter more than anything else here.
 *
 * **It runs against its own database.** The manager scenario suspends a seller
 * and moves listing statuses around; pointed at the database that serves the
 * deployed demo, it would leave a reviewer looking at a suspended participant
 * and half-hidden listings. `.env.test` targets a separate Neon database, and
 * `globalSetup` re-seeds it before every run, so each run starts from the same
 * known state and a failed run cannot poison the next one.
 *
 * **It runs against a production build**, not `next dev`. Dev and prod differ in
 * rendering mode and error handling, and this project has already produced a
 * finding that only showed up in the built output — testing the thing that ships
 * is the point.
 */

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Read `.env.test` and hand it to the server process.
 *
 * Next loads `.env` on its own, which would point the server at the demo
 * database; passing these explicitly overrides that for the test run only.
 */
function loadTestEnv(): Record<string, string> {
  const raw = readFileSync(".env.test", "utf8");
  const env: Record<string, string> = {};

  for (const line of raw.split("\n")) {
    const match = /^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    env[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }

  return env;
}

export default defineConfig({
  testDir: "./e2e",
  // Serial on purpose: the manager scenario mutates shared state (a seller's
  // status), so parallel workers would race each other through the same rows.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  globalSetup: "./e2e/global-setup.ts",

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    locale: "en-GB",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    // Build once, then serve. `next start` refuses to run without a build, so a
    // missing .next fails loudly rather than silently testing an old bundle.
    command: `npm run build && npx next start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 300_000,
    // The suite deliberately runs with no GEMINI_API_KEY: every AI feature has a
    // deterministic path underneath it, and these tests exercise that path.
    env: loadTestEnv(),
  },
});
