import { expect, test } from "@playwright/test";

import { moderateWithReason, publicListingCount, signInAs, signOut } from "./helpers";

/**
 * The manager's path, and the one edge case this whole data model exists for.
 *
 * Suspending a seller must hide their listings from the public catalogue without
 * touching the listings themselves, so unsuspending restores exactly what was
 * there before. This test measures that as a visitor would: it counts the
 * catalogue before, after the suspension, and after the reversal.
 */
test.describe("platform manager", () => {
  const seller = "James Whitfield";
  const suspendReason = "Automated end-to-end check of the suspension cascade.";
  const restoreReason = "Automated end-to-end check complete; reinstating the seller.";

  test("suspending a seller hides their listings and unsuspending restores them", async ({
    page,
  }) => {
    // --- Baseline, seen as a visitor -------------------------------------
    const before = await publicListingCount(page);
    expect(before).toBeGreaterThan(0);

    await signInAs(page, "Platform manager");

    // --- Suspend ----------------------------------------------------------
    await page.goto("/en/moderation/participants?q=Whitfield");
    await expect(page.getByText(seller)).toBeVisible();
    await moderateWithReason(page, "Suspend", suspendReason);

    await expect(page.getByText("Suspended").first()).toBeVisible();

    const during = await publicListingCount(page);
    expect(during).toBeLessThan(before);

    // --- Unsuspend --------------------------------------------------------
    await page.goto("/en/moderation/participants?q=Whitfield");
    await moderateWithReason(page, "Unsuspend", restoreReason);

    const after = await publicListingCount(page);

    // The exact number comes back. That only holds because suspension never
    // wrote to the listings — the catalogue hides them by joining on the
    // seller's status instead.
    expect(after).toBe(before);

    // --- Both actions are on the record -----------------------------------
    await page.goto("/en/moderation/audit");
    await expect(page.getByText(suspendReason)).toBeVisible();
    await expect(page.getByText(restoreReason)).toBeVisible();
    await expect(page.getByText("Unsuspended").first()).toBeVisible();
  });

  test("a suspended participant cannot sign in", async ({ page }) => {
    await signInAs(page, "Platform manager");

    await page.goto("/en/moderation/participants?q=Whitfield");
    await moderateWithReason(
      page,
      "Suspend",
      "Automated check that a suspended account is refused at sign-in.",
    );
    await signOut(page);

    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill("james.whitfield@n5deal.demo");
    await page.getByLabel("Password").fill("demo1234");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/This account is suspended/)).toBeVisible();

    // Put the seed back the way it was, so the next scenario starts clean even
    // if it runs against the same database in the same session.
    await signInAs(page, "Platform manager");
    await page.goto("/en/moderation/participants?q=Whitfield");
    await moderateWithReason(
      page,
      "Unsuspend",
      "Automated check complete; restoring the seller to active.",
    );
  });

  test("moderation is closed to everyone else", async ({ page }) => {
    await signInAs(page, "Buyer");

    for (const path of ["/en/moderation/participants", "/en/moderation/assets"]) {
      const response = await page.request.get(path);
      expect(response.status()).toBe(403);
    }
  });
});
