import { describe, expect, it } from "vitest";
import type { AssetBenefit, BusinessCategory, LicenseType } from "@prisma/client";

import { MAX_MATCH_SCORE, matchBand, scoreMatch } from "@/lib/matching";

/**
 * The matching score is the one place where the AI feature could have been a
 * black box and deliberately is not. These tests are what make the claim
 * "the model explains, it does not decide" checkable.
 */

const asset = {
  category: "EMONEY" as BusinessCategory,
  country: "LT",
  licenseType: "EMI" as LicenseType,
  businessStatus: "LICENSE_ONLY" as const,
  askingPrice: 300_000_000n, // EUR 3M
  benefits: ["IBAN", "SEPA"] as AssetBenefit[],
};

const mandate = {
  targetCategories: ["EMONEY"] as BusinessCategory[],
  targetCountries: ["LT", "MT"],
  targetLicenseTypes: ["EMI"] as LicenseType[],
  ticketMin: 100_000_000n, // EUR 1M
  ticketMax: 600_000_000n, // EUR 6M
  needsActiveLicense: false,
};

describe("scoreMatch", () => {
  it("scores a mandate that matches on every axis at 100", () => {
    expect(scoreMatch({ asset, mandate }).score).toBe(100);
  });

  it("weighs the whole scale at exactly 100 points", () => {
    expect(MAX_MATCH_SCORE).toBe(100);
  });

  it("drops the score and names the gap when the jurisdiction is wrong", () => {
    const result = scoreMatch({
      asset: { ...asset, country: "SG" },
      mandate,
    });

    expect(result.score).toBe(75);
    expect(result.gaps.map((g) => g.key)).toContain("country");
    expect(result.gaps[0].detail).toContain("Singapore");
  });

  it("treats a price just over the ceiling as negotiable, not disqualifying", () => {
    // EUR 6.6M against a EUR 6M ceiling: 10% over.
    const slightlyOver = scoreMatch({
      asset: { ...asset, askingPrice: 660_000_000n },
      mandate,
    });
    // EUR 20M against the same ceiling.
    const farOver = scoreMatch({
      asset: { ...asset, askingPrice: 2_000_000_000n },
      mandate,
    });

    expect(slightlyOver.score).toBeGreaterThan(farOver.score);
    expect(slightlyOver.score).toBeGreaterThanOrEqual(85);
    expect(farOver.score).toBeLessThan(80);
  });

  it("keeps more credit for being under the floor than over the ceiling", () => {
    const under = scoreMatch({ asset: { ...asset, askingPrice: 50_000_000n }, mandate });
    const over = scoreMatch({
      asset: { ...asset, askingPrice: 2_000_000_000n },
      mandate,
    });
    expect(under.score).toBeGreaterThan(over.score);
  });

  it("fails the operating requirement when the buyer insists on one", () => {
    const result = scoreMatch({
      asset,
      mandate: { ...mandate, needsActiveLicense: true },
    });

    expect(result.gaps.map((g) => g.key)).toContain("operatingRequirement");
    expect(result.score).toBeLessThan(100);
  });

  it("reads an empty target list as no preference, not as a mismatch", () => {
    // A buyer who narrowed nothing should not be scored a bad fit for everything,
    // but should still rank below one who named this exact category.
    const open = scoreMatch({
      asset,
      mandate: { ...mandate, targetCategories: [] },
    });
    const exact = scoreMatch({ asset, mandate });

    expect(open.score).toBeLessThan(exact.score);
    expect(open.score).toBeGreaterThan(50);
    expect(open.gaps.map((g) => g.key)).not.toContain("category");
  });

  it("is deterministic — the same inputs always give the same score", () => {
    const a = scoreMatch({ asset, mandate });
    const b = scoreMatch({ asset, mandate });
    expect(a.score).toBe(b.score);
    expect(a.strengths.map((f) => f.key)).toEqual(b.strengths.map((f) => f.key));
  });

  it("gives every factor a human-readable detail line", () => {
    const result = scoreMatch({ asset, mandate });
    for (const factor of result.factors) {
      expect(factor.detail.length).toBeGreaterThan(10);
    }
  });
});

describe("matchBand", () => {
  it("splits at the thresholds the badge colours use", () => {
    expect(matchBand(100)).toBe("strong");
    expect(matchBand(75)).toBe("strong");
    expect(matchBand(74)).toBe("possible");
    expect(matchBand(50)).toBe("possible");
    expect(matchBand(49)).toBe("weak");
  });
});
