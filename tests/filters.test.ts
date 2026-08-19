import { describe, expect, it } from "vitest";

import {
  MAX_PAGE,
  buildQuery,
  hasActiveAssetFilters,
  parseAssetFilters,
  parseBuyerFilters,
} from "@/lib/filters";

/**
 * The URL is the catalogue's only state, which makes the parser a trust
 * boundary: anything can be typed into an address bar. It has to be forgiving
 * about nonsense and strict about what reaches a query.
 */
describe("parseAssetFilters", () => {
  it("reads a comma-separated facet", () => {
    const filters = parseAssetFilters({ category: "EMONEY,PAYMENTS" });
    expect(filters.categories).toEqual(["EMONEY", "PAYMENTS"]);
  });

  it("also accepts repeated keys, which hand-written links use", () => {
    const filters = parseAssetFilters({ category: ["EMONEY", "PAYMENTS"] });
    expect(filters.categories).toEqual(["EMONEY", "PAYMENTS"]);
  });

  it("drops values outside the vocabulary rather than throwing", () => {
    // A typo in the address bar must not be a 500.
    const filters = parseAssetFilters({ category: "EMONEY,PAYMNETS,../../etc" });
    expect(filters.categories).toEqual(["EMONEY"]);
  });

  it("deduplicates while keeping the chosen order", () => {
    const filters = parseAssetFilters({ country: "MT,LT,MT" });
    expect(filters.countries).toEqual(["MT", "LT"]);
  });

  it("swaps a reversed price range instead of returning nothing", () => {
    const filters = parseAssetFilters({ priceMin: "5000000", priceMax: "1000000" });
    expect(filters.priceMin).toBe(100_000_000n);
    expect(filters.priceMax).toBe(500_000_000n);
  });

  it("clamps the page so a hand-typed offset cannot ask Postgres for millions of rows", () => {
    // "1e9" is a valid number, so it clamps to the ceiling rather than falling
    // back to page one — either way Postgres never sees the offset.
    expect(parseAssetFilters({ page: "1e9" }).page).toBe(MAX_PAGE);
    expect(parseAssetFilters({ page: "999999" }).page).toBe(MAX_PAGE);
    expect(parseAssetFilters({ page: "-4" }).page).toBe(1);
    expect(parseAssetFilters({ page: "abc" }).page).toBe(1);
  });

  it("caps the search term", () => {
    const filters = parseAssetFilters({ q: "x".repeat(500) });
    expect(filters.q).toHaveLength(120);
  });

  it("falls back to the default sort for an unknown value", () => {
    expect(parseAssetFilters({ sort: "cheapest" }).sort).toBe("newest");
    expect(parseAssetFilters({ sort: "priceAsc" }).sort).toBe("priceAsc");
  });
});

describe("parseBuyerFilters", () => {
  it("reads the tri-state boolean as three distinct states", () => {
    expect(parseBuyerFilters({}).needsActiveLicense).toBeNull();
    expect(parseBuyerFilters({ needsActive: "1" }).needsActiveLicense).toBe(true);
    expect(parseBuyerFilters({ needsActive: "0" }).needsActiveLicense).toBe(false);
    // Anything else means "no preference", not "false".
    expect(parseBuyerFilters({ needsActive: "maybe" }).needsActiveLicense).toBeNull();
  });
});

describe("hasActiveAssetFilters", () => {
  it("is false for an untouched catalogue and true once anything is set", () => {
    expect(hasActiveAssetFilters(parseAssetFilters({}))).toBe(false);
    expect(hasActiveAssetFilters(parseAssetFilters({ page: "3" }))).toBe(false);
    expect(hasActiveAssetFilters(parseAssetFilters({ q: "emi" }))).toBe(true);
    expect(hasActiveAssetFilters(parseAssetFilters({ priceMax: "1M" }))).toBe(true);
  });
});

describe("buildQuery", () => {
  it("removes a key when the value is emptied", () => {
    expect(buildQuery({ category: "EMONEY" }, { category: null })).toBe("");
    expect(buildQuery({ q: "emi" }, { q: "" })).toBe("");
  });

  it("joins a list back into one comma-separated parameter", () => {
    expect(buildQuery({}, { category: ["EMONEY", "PAYMENTS"] })).toBe(
      "?category=EMONEY%2CPAYMENTS",
    );
  });

  it("resets to page one whenever a filter changes", () => {
    // Narrowing a filter from page 7 would otherwise land on an empty list that
    // looks like a bug.
    expect(buildQuery({ page: "7", q: "emi" }, { category: ["CRYPTO"] })).toBe(
      "?category=CRYPTO&q=emi",
    );
  });

  it("keeps the page when the page itself is what changed", () => {
    expect(buildQuery({ q: "emi" }, { page: 3 })).toBe("?page=3&q=emi");
  });

  it("never writes page=1 explicitly", () => {
    expect(buildQuery({ q: "emi" }, { page: 1 })).toBe("?q=emi");
  });

  it("orders keys so one selection always produces one URL", () => {
    const a = buildQuery({}, { q: "emi", category: ["CRYPTO"], sort: "priceAsc" });
    const b = buildQuery({}, { sort: "priceAsc", category: ["CRYPTO"], q: "emi" });
    expect(a).toBe(b);
  });

  it("drops false, which is how an unchecked box arrives", () => {
    expect(buildQuery({ needsActive: "1" }, { needsActive: false })).toBe("");
  });
});
