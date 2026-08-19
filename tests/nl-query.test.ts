import { describe, expect, it } from "vitest";

import { parseNaturalQuery, proposalIsEmpty } from "@/lib/nl-query";

/**
 * The deterministic half of the AI search.
 *
 * This is what a reviewer running the app with no API key actually gets, so it
 * is tested as a feature in its own right rather than as a stopgap.
 */
describe("parseNaturalQuery", () => {
  it("pulls category, jurisdiction and a price ceiling out of one sentence", () => {
    const result = parseNaturalQuery("EMI in Lithuania under 2M with IBAN");

    expect(result.categories).toContain("EMONEY");
    expect(result.licenseTypes).toContain("EMI");
    expect(result.countries).toContain("LT");
    expect(result.priceMaxMajor).toBe(2_000_000);
  });

  it("expands EU into the member states it knows", () => {
    const result = parseNaturalQuery("payment licence in the EU");
    expect(result.countries).toContain("LT");
    expect(result.countries).toContain("MT");
    expect(result.countries).not.toContain("SG");
  });

  it("understands the aliases people type instead of ISO codes", () => {
    expect(parseNaturalQuery("MSO in the UK")?.countries).toContain("GB");
    expect(parseNaturalQuery("VASP in the UAE")?.countries).toContain("AE");
  });

  it("does not mistake ordinary words for country codes", () => {
    // "it" must not select Italy, "in" must not select India.
    const result = parseNaturalQuery("is it an operating business");
    expect(result.countries ?? []).not.toContain("IT");
  });

  it("reads both ends of a stated range", () => {
    const result = parseNaturalQuery("crypto business between 500k and 3 million");
    expect(result.priceMinMajor).toBe(500_000);
    expect(result.priceMaxMajor).toBe(3_000_000);
  });

  it("reads a floor as well as a ceiling", () => {
    expect(parseNaturalQuery("bank over 10M").priceMinMajor).toBe(10_000_000);
    expect(parseNaturalQuery("licence up to 750k").priceMaxMajor).toBe(750_000);
  });

  it("separates a clean licence from an operating business", () => {
    expect(parseNaturalQuery("clean licence in Malta").businessStatuses).toEqual([
      "LICENSE_ONLY",
    ]);
    expect(parseNaturalQuery("operating payments business").businessStatuses).toEqual([
      "ACTIVE",
    ]);
  });

  it("keeps the words it did not consume as free text", () => {
    // The company name is not a filter, so it must survive into the search term.
    const result = parseNaturalQuery("EMI in Malta from Adriatic Deal House");
    expect(result.q?.toLowerCase()).toContain("adriatic");
  });

  it("does not leave consumed words in the free text", () => {
    // Leaving "Lithuania" in `q` would match no title and empty the results that
    // the country filter had just got right.
    const result = parseNaturalQuery("EMI in Lithuania under 2M");
    expect((result.q ?? "").toLowerCase()).not.toContain("lithuania");
    expect((result.q ?? "").toLowerCase()).not.toContain("emi");
  });

  it("reports an unstructured query as weak rather than inventing filters", () => {
    const result = parseNaturalQuery("something interesting please");
    expect(proposalIsEmpty(result)).toBe(true);
  });
});
