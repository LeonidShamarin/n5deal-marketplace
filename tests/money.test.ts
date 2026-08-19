import { describe, expect, it } from "vitest";

import {
  formatMoneyCompact,
  formatRange,
  isWithinRange,
  parseMajorUnits,
  toMajorUnits,
} from "@/lib/money";

/**
 * Money is the field most likely to be typed three different ways by three
 * different people, and the one where being wrong is least forgivable. These
 * tests pin the parser's behaviour on the inputs a real seller produces.
 */
describe("parseMajorUnits", () => {
  it("reads a plain integer as whole major units", () => {
    expect(parseMajorUnits("2500000")).toBe(250_000_000n);
  });

  it("accepts the separators people actually paste", () => {
    // Space-grouped, comma-grouped and dot-grouped all mean the same number.
    expect(parseMajorUnits("2 500 000")).toBe(250_000_000n);
    expect(parseMajorUnits("2,500,000")).toBe(250_000_000n);
    expect(parseMajorUnits("2.500.000")).toBe(250_000_000n);
  });

  it("handles a non-breaking space, which is what a browser-formatted number carries", () => {
    expect(parseMajorUnits("2 500 000")).toBe(250_000_000n);
  });

  it("treats a trailing group of one or two digits as decimals, either separator", () => {
    expect(parseMajorUnits("1234.5")).toBe(123_450n);
    expect(parseMajorUnits("1,234.56")).toBe(123_456n);
    expect(parseMajorUnits("1.234,56")).toBe(123_456n);
  });

  it("expands the shorthand used in deal listings", () => {
    expect(parseMajorUnits("2.5M")).toBe(250_000_000n);
    expect(parseMajorUnits("750k")).toBe(75_000_000n);
    expect(parseMajorUnits("1,2M")).toBe(120_000_000n);
  });

  it("keeps precision past the float safe range", () => {
    // 12 digits of major units is 14 of minor units — beyond where Number stops
    // being exact, which is the whole reason this returns bigint.
    expect(parseMajorUnits("123456789012.34")).toBe(12_345_678_901_234n);
  });

  it("rejects what it cannot read instead of guessing", () => {
    expect(parseMajorUnits("")).toBeNull();
    expect(parseMajorUnits("   ")).toBeNull();
    expect(parseMajorUnits("abc")).toBeNull();
    expect(parseMajorUnits("2.5X")).toBeNull();
    expect(parseMajorUnits("-100")).toBeNull();
  });
});

describe("toMajorUnits", () => {
  it("round-trips a whole amount", () => {
    expect(toMajorUnits(250_000_000n)).toBe(2_500_000);
  });
});

describe("formatMoneyCompact", () => {
  it("drops the cents on round amounts and keeps the layout narrow", () => {
    expect(formatMoneyCompact(250_000_000n, "EUR", "en")).toBe("€2.5M");
    expect(formatMoneyCompact(75_000_000n, "EUR", "en")).toBe("€750K");
    expect(formatMoneyCompact(45_000n, "EUR", "en")).toBe("€450");
  });
});

describe("formatRange", () => {
  it("says what is actually bounded", () => {
    expect(formatRange(100_000_000n, 600_000_000n, "EUR", "en")).toBe("€1M – €6M");
    expect(formatRange(100_000_000n, null, "EUR", "en")).toBe("€1M+");
    expect(formatRange(null, 600_000_000n, "EUR", "en")).toBe("≤ €6M");
    expect(formatRange(null, null, "EUR", "en")).toBe("—");
  });
});

describe("isWithinRange", () => {
  it("is inclusive at both ends", () => {
    expect(isWithinRange(100n, 100n, 200n)).toBe(true);
    expect(isWithinRange(200n, 100n, 200n)).toBe(true);
    expect(isWithinRange(99n, 100n, 200n)).toBe(false);
    expect(isWithinRange(201n, 100n, 200n)).toBe(false);
  });

  it("treats a missing bound as unbounded", () => {
    expect(isWithinRange(10n, null, null)).toBe(true);
    expect(isWithinRange(10n, null, 5n)).toBe(false);
    expect(isWithinRange(10n, 50n, null)).toBe(false);
  });
});
