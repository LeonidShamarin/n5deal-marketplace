import { describe, expect, it } from "vitest";

import { assetInputSchema } from "@/lib/asset-schema";
import { isPublishable, reviewListing } from "@/lib/listing-review";
import { threadKey } from "@/lib/thread-key";

const base = {
  title: "EMI licence in Lithuania with live IBAN issuing",
  description:
    "Electronic money institution authorised by the Bank of Lithuania. The entity is clean, with the licence in good standing, no operations, no clients and no liabilities. A full data room is available to qualified buyers after NDA, including regulatory correspondence for the last two years.",
  category: "EMONEY",
  licenseType: "EMI",
  country: "LT",
  businessStatus: "LICENSE_ONLY",
  regulator: "Bank of Lithuania",
  askingPrice: "2500000",
  currency: "EUR",
  employees: "",
  yearOfIssue: "2019",
  benefits: ["IBAN", "SEPA"],
};

function parse(overrides: Partial<typeof base> = {}) {
  const parsed = assetInputSchema.safeParse({ ...base, ...overrides });
  if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues));
  return parsed.data;
}

describe("assetInputSchema", () => {
  it("turns a typed amount into minor units", () => {
    expect(parse({ askingPrice: "2.5M" }).askingPrice).toBe(250_000_000n);
  });

  it("refuses an unreadable amount", () => {
    const result = assetInputSchema.safeParse({ ...base, askingPrice: "about two" });
    expect(result.success).toBe(false);
  });

  it("refuses a price of zero", () => {
    const result = assetInputSchema.safeParse({ ...base, askingPrice: "0" });
    expect(result.success).toBe(false);
  });

  it("refuses a licence issued in the future", () => {
    // The schema owns this check, which is why reviewListing does not repeat it.
    const nextYear = String(new Date().getFullYear() + 1);
    const result = assetInputSchema.safeParse({ ...base, yearOfIssue: nextYear });
    expect(result.success).toBe(false);
  });

  it("treats empty optional numbers as absent, not as zero", () => {
    const data = parse({ employees: "", yearOfIssue: "" });
    expect(data.employees).toBeNull();
    expect(data.yearOfIssue).toBeNull();
  });
});

describe("reviewListing", () => {
  it("passes a complete, coherent draft", () => {
    const issues = reviewListing(parse());
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
    expect(isPublishable(issues)).toBe(true);
  });

  it("blocks a licence type the jurisdiction does not issue", () => {
    // Singapore has no EMI regime — this is a checkable fact, not an opinion,
    // so it is an error rather than a hint.
    const issues = reviewListing(parse({ country: "SG", regulator: "MAS" }));
    const error = issues.find((i) => i.severity === "error");

    expect(error).toBeDefined();
    expect(error?.field).toBe("licenseType");
    expect(isPublishable(issues)).toBe(false);
  });

  it("flags an operating business with no staff", () => {
    const issues = reviewListing(parse({ businessStatus: "ACTIVE", employees: "0" }));
    expect(issues.some((i) => i.field === "employees" && i.severity === "warning")).toBe(
      true,
    );
  });

  it("flags a licence-only sale carrying a whole team", () => {
    const issues = reviewListing(parse({ employees: "25" }));
    expect(
      issues.some((i) => i.field === "businessStatus" && i.severity === "warning"),
    ).toBe(true);
  });

  it("flags a price far under market for the licence type", () => {
    const issues = reviewListing(parse({ askingPrice: "5000" }));
    expect(issues.some((i) => i.field === "askingPrice")).toBe(true);
  });

  it("flags a missing regulator", () => {
    const issues = reviewListing(parse({ regulator: "" }));
    expect(issues.some((i) => i.field === "regulator")).toBe(true);
  });

  it("warns but does not block when nothing is listed as included", () => {
    const issues = reviewListing(parse({ benefits: [] }));
    expect(issues.some((i) => i.field === "benefits")).toBe(true);
    expect(isPublishable(issues)).toBe(true);
  });
});

describe("threadKey", () => {
  it("is stable for the same asset and pair", () => {
    expect(threadKey("asset1", "buyer1", "seller1")).toBe(
      threadKey("asset1", "buyer1", "seller1"),
    );
  });

  it("gives a null asset one fixed key rather than a distinct one each time", () => {
    // This is the whole reason the column exists: Postgres treats NULLs as
    // distinct, so a composite unique would allow two "general" threads between
    // the same pair.
    expect(threadKey(null, "buyer1", "seller1")).toBe("general:buyer1:seller1");
    expect(threadKey(null, "buyer1", "seller1")).toBe(
      threadKey(null, "buyer1", "seller1"),
    );
  });

  it("separates a general thread from an asset thread between the same pair", () => {
    expect(threadKey(null, "b", "s")).not.toBe(threadKey("a1", "b", "s"));
  });

  it("separates different pairs", () => {
    expect(threadKey("a1", "b1", "s1")).not.toBe(threadKey("a1", "b2", "s1"));
  });
});
