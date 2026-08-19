import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers";

/**
 * The buyer's path: arrive, see what matches the mandate, and reach a seller.
 *
 * The assertion that matters is not "a page rendered" but that the match panel
 * carries its reasons — that is the deterministic scorer running with no API key
 * configured, which is the whole claim behind the AI features.
 */
test.describe("buyer", () => {
  test("signs in, sees matched listings with reasons, and contacts a seller", async ({
    page,
  }) => {
    await signInAs(page, "Buyer");

    // --- The mandate and its matches ------------------------------------
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    // `exact` matters: "Listings matching your mandate" is also a heading.
    await expect(
      page.getByRole("heading", { name: "Your mandate", exact: true }),
    ).toBeVisible();

    // The score is computed, not generated, so the panel must carry its reasons
    // even though this run has no API key and therefore no model prose.
    await expect(page.getByText(/WHY THIS FITS/i).first()).toBeVisible();
    await expect(
      page
        .getByText(/is on the mandate's target list|target jurisdiction|ticket range/i)
        .first(),
    ).toBeVisible();

    // --- Open the best-matching listing ---------------------------------
    await page.getByRole("button", { name: "View asset" }).first().click();
    await page.waitForURL(/\/en\/assets\/\d+/);

    const assetHeading = page.getByRole("heading", { name: /Asset ID #\d+/ });
    await expect(assetHeading).toBeVisible();
    const assetLabel = await assetHeading.innerText();

    // --- Contact the seller ---------------------------------------------
    await page.getByRole("button", { name: "Contact seller" }).click();

    const body = page.getByPlaceholder(/Introduce yourself/);
    await expect(body).toBeVisible();
    await body.fill(
      "Hello — is the licence transferable without a fresh regulatory assessment?",
    );
    await page.getByRole("button", { name: "Send message" }).click();

    // Landing in the thread is the proof the server accepted it.
    await page.waitForURL(/\/en\/inbox\/[a-z0-9]+/, { timeout: 20_000 });
    await expect(page.getByText(/is the licence transferable/)).toBeVisible();
    await expect(page.getByText(assetLabel.replace("Asset ID ", ""))).toBeVisible();

    // --- And it is in the inbox ------------------------------------------
    await page.goto("/en/inbox");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(page.getByText(/is the licence transferable/)).toBeVisible();
  });

  test("contacting the same listing twice reuses the thread", async ({ page }) => {
    await signInAs(page, "Buyer");

    await page.goto("/en/assets");
    await page.getByRole("button", { name: "View asset" }).first().click();
    await page.waitForURL(/\/en\/assets\/\d+/);

    async function contact(message: string): Promise<string> {
      await page.getByRole("button", { name: "Contact seller" }).click();
      await page.getByPlaceholder(/Introduce yourself/).fill(message);
      await page.getByRole("button", { name: "Send message" }).click();
      await page.waitForURL(/\/en\/inbox\/[a-z0-9]+/, { timeout: 20_000 });
      return page.url();
    }

    const first = await contact("First enquiry about this listing, sent for the test.");
    await page.goBack();
    await page.waitForURL(/\/en\/assets\/\d+/);
    const second = await contact("Second enquiry about the very same listing.");

    // The unique thread key is what makes this hold; without it Postgres would
    // happily store two conversations for the same pair and listing.
    expect(second).toBe(first);
    await expect(page.getByText(/First enquiry about this listing/)).toBeVisible();
    await expect(page.getByText(/Second enquiry about the very same/)).toBeVisible();
  });
});
