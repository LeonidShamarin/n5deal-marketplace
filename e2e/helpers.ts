import { expect, type Page } from "@playwright/test";

export type DemoRole = "Seller" | "Buyer" | "Platform manager";

/**
 * Sign in through the landing page's one-click buttons.
 *
 * Deliberately the same path a reviewer takes, rather than injecting a session
 * cookie: if the credentials flow breaks, every scenario should fail loudly at
 * the first step instead of quietly testing a shortcut that users never use.
 */
export async function signInAs(page: Page, role: DemoRole): Promise<void> {
  await page.goto("/en");
  await page.getByRole("button", { name: `Continue as ${role}` }).click();

  // The dashboard is the landing point for every role.
  await page.waitForURL("**/en/dashboard", { timeout: 20_000 });
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/en", { timeout: 20_000 });
}

/**
 * How many listings the public catalogue is currently showing.
 *
 * Read from the results line rather than from the database, because the point of
 * the cascade test is what a visitor sees.
 */
export async function publicListingCount(page: Page): Promise<number> {
  await page.goto("/en/assets");
  const text = await page
    .getByText(/^\d+ results?$/)
    .first()
    .innerText();
  const parsed = Number(text.replace(/\D/g, ""));
  expect(Number.isInteger(parsed)).toBe(true);
  return parsed;
}

/**
 * Fill in a moderation reason and confirm.
 *
 * The panel only appears after the action button is pressed, and Confirm stays
 * disabled until the reason is long enough — both are product rules, so the
 * helper waits for them rather than working around them.
 */
export async function moderateWithReason(
  page: Page,
  action: "Suspend" | "Unsuspend" | "Remove",
  reason: string,
): Promise<void> {
  await page.getByRole("button", { name: action, exact: true }).first().click();

  const box = page.getByPlaceholder(/State what the participant did/);
  await expect(box).toBeVisible();
  await box.fill(reason);

  const confirm = page.getByRole("button", { name: "Confirm" });
  await expect(confirm).toBeEnabled();
  await confirm.click();

  // The panel closes once the server has accepted the change.
  await expect(box).toBeHidden({ timeout: 20_000 });
}
