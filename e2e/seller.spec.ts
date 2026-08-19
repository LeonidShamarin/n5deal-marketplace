import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers";

/**
 * The seller's path: draft a listing, see it stay private, publish it, find it
 * in the public catalogue.
 *
 * The draft step is the one worth having. A listing that appears publicly before
 * the seller says so would be the worst possible bug in this product, and it is
 * exactly the kind that a screenshot review would miss.
 */
test.describe("seller", () => {
  // A distinctive title so the catalogue search can find this listing and only
  // this listing, even though the seed contains similar ones.
  const title = `E2E test EMI licence ${Date.now()}`;

  test("drafts a listing privately, then publishes it into the catalogue", async ({
    page,
  }) => {
    await signInAs(page, "Seller");

    // --- Create it as a draft --------------------------------------------
    await page.goto("/en/dashboard/listings/new");
    await expect(page.getByRole("heading", { name: "New listing" })).toBeVisible();

    await page.getByLabel("Listing title").fill(title);
    await page
      .getByLabel("Description")
      .fill(
        "Electronic money institution authorised by the Bank of Lithuania. The licence is in good standing with no operations, no clients and no liabilities. A full data room is available to qualified buyers after NDA, including two years of regulatory correspondence.",
      );
    await page.getByLabel("Type of business").selectOption("EMONEY");
    await page.getByLabel("Type of licence").selectOption("EMI");
    await page.getByLabel("Jurisdiction").selectOption("LT");
    await page.getByLabel("Regulator").fill("Bank of Lithuania");
    await page.getByLabel("Business status").selectOption("LICENSE_ONLY");
    await page.getByLabel("Asking price").fill("2 400 000");
    await page.getByLabel("Year of issue").fill("2019");
    await page.getByLabel("IBAN issuing").check();

    await page.getByRole("button", { name: "Save as draft" }).click();
    await page.waitForURL(/\/en\/assets\/\d+/, { timeout: 20_000 });

    const url = page.url();
    const ref = url.split("/").pop()!;

    // Its owner sees it, and sees that it is not live.
    await expect(page.getByText(/This listing is not public/)).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();

    // --- A draft must not be in the public catalogue ---------------------
    await page.goto(`/en/assets?q=${encodeURIComponent(title)}`);
    await expect(page.getByText("No listings match these filters")).toBeVisible();

    // --- Publish it from the dashboard -----------------------------------
    await page.goto("/en/dashboard");
    const row = page.locator("li", { hasText: title });
    await expect(row).toBeVisible();
    await expect(row.getByText("Draft")).toBeVisible();

    await row.getByRole("button", { name: "Publish" }).click();
    await expect(row.getByText("Published")).toBeVisible({ timeout: 20_000 });

    // --- Now it is findable by anyone ------------------------------------
    await page.goto(`/en/assets?q=${encodeURIComponent(title)}`);
    await expect(page.getByText("1 result")).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByRole("heading", { name: `Asset ID #${ref}` })).toBeVisible();
  });

  test("cannot open another seller's listing for editing", async ({ page }) => {
    await signInAs(page, "Seller");

    // Find a listing this seller does not own by reading the catalogue, then ask
    // for its edit page directly — the URL a curious user would try.
    await page.goto("/en/assets");
    const otherSellersRef = await page.evaluate(async () => {
      const own = "Baltic Licence Partners";
      const cards = [...document.querySelectorAll("h3")];
      for (const card of cards) {
        const article = card.closest("div.rounded-2xl");
        if (article && !article.textContent?.includes(own)) {
          return /#(\d+)/.exec(card.textContent ?? "")?.[1] ?? null;
        }
      }
      return null;
    });

    expect(otherSellersRef).not.toBeNull();

    const response = await page.request.get(`/en/dashboard/listings/${otherSellersRef}`);
    // A real 403, not a redirect that pretends the page never existed.
    expect(response.status()).toBe(403);
  });
});
